import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { WorklogLang } from '../cairn/run-options.js';
import { isOperator } from '../common/operator.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import { summaryModelLabel } from '../common/summary-model.js';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { enforceBlockEgress } from './block-egress.js';
import { NotionApiClient } from './notion-api.client.js';
import {
  bulletItem,
  claudeCallout,
  codeBlock,
  heading2,
  heading3,
  paragraph,
} from './notion-blocks.js';

const WORKLOG_DB_TITLE = 'Daily Worklog (cairn)';
const RAW_DUMP_CHUNK_SIZE = 1900;
const RAW_DUMP_MAX_CHUNKS = 8;

export interface PublishWorklogInput {
  date: string;
  force: boolean;
  github: GithubActivity | null;
  localGit: LocalGitActivity | null;
  summary?: WorklogSummary | null;
  lang: WorklogLang;
}

export type PublishWorklogResult =
  | { kind: 'created'; pageId: string; url: string | null }
  | { kind: 'recreated'; pageId: string; url: string | null; archivedPageId: string }
  | { kind: 'skipped'; reason: 'already-published' | 'final-protected'; pageId: string }
  | { kind: 'no-target' };

@Injectable()
export class NotionPublisherService {
  constructor(
    private readonly client: NotionApiClient,
    private readonly worklogConfig: WorklogConfigService,
    private readonly secrets: SecretsService,
    @InjectPinoLogger(NotionPublisherService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findPublishedDates(rangeStart: string, rangeEnd: string): Promise<Set<string>> {
    const target = this.worklogConfig.findWorklogWorkspace();
    if (!target) return new Set();

    const token = this.secrets.getEnv(target.tokenEnv);
    if (!token) return new Set();

    const dataSourceId = target.worklog?.dataSourceId;
    if (!dataSourceId) return new Set();

    try {
      const pages = await this.client.queryWorklogPagesInRange(
        token,
        dataSourceId,
        rangeStart,
        rangeEnd,
      );
      return new Set(pages.map((p) => p.date));
    } catch (err) {
      this.logger.warn(
        { rangeStart, rangeEnd, err: String(err) },
        'findPublishedDates failed — assuming none published',
      );
      return new Set();
    }
  }

  // force 실행에선 orchestrator 가 precheck 자체를 건너뛴다 — 여기선 non-force 만 가정.
  // API 에러는 '페이지 없음'(null)과 구분 — 요약 비용 재지출 방지
  async precheckDaily(
    date: string,
  ): Promise<PublishWorklogResult | { kind: 'precheck-error' } | null> {
    const target = this.worklogConfig.findWorklogWorkspace();
    if (!target) return { kind: 'no-target' };

    const token = this.secrets.getEnv(target.tokenEnv);
    if (!token) return { kind: 'no-target' };

    const dataSourceId = target.worklog?.dataSourceId;
    if (!dataSourceId) return null;

    try {
      const existing = await this.client.findWorklogPageByDate(token, dataSourceId, date);
      if (!existing) return null;
      if (existing.status === 'final') {
        return { kind: 'skipped', reason: 'final-protected', pageId: existing.pageId };
      }
      return { kind: 'skipped', reason: 'already-published', pageId: existing.pageId };
    } catch (err) {
      this.logger.warn({ date, err: String(err) }, 'precheckDaily failed');
      return { kind: 'precheck-error' };
    }
  }

  async publish(input: PublishWorklogInput): Promise<PublishWorklogResult> {
    const target = this.worklogConfig.findWorklogWorkspace();
    const startedAt = Date.now();

    this.logger.info({ date: input.date, force: input.force }, 'notion publish start');

    if (!target) {
      this.logger.warn(
        'no notionWorkspace with worklog target — publisher skipped (set worklog.pageId or worklog.databaseId in worklog.config.json)',
      );
      return { kind: 'no-target' };
    }

    const token = this.secrets.getEnv(target.tokenEnv);
    if (!token) {
      this.logger.warn(
        { workspace: target.label, tokenEnv: target.tokenEnv },
        'token not set — publisher skipped',
      );
      return { kind: 'no-target' };
    }

    const ensureStartedAt = Date.now();
    const { dataSourceId } = await this.ensureDatabaseAndDataSource(target, token);
    this.logger.info(
      { date: input.date, elapsedMs: Date.now() - ensureStartedAt },
      'notion publish target resolved',
    );

    const lookupStartedAt = Date.now();
    const existing = await this.client.findWorklogPageByDate(token, dataSourceId, input.date);
    this.logger.info(
      { date: input.date, elapsedMs: Date.now() - lookupStartedAt, found: !!existing },
      'notion publish existing lookup done',
    );
    if (existing) {
      if (existing.status === 'final') {
        this.logger.info(
          { date: input.date, pageId: existing.pageId },
          'worklog page is final — protected from overwrite',
        );
        return { kind: 'skipped', reason: 'final-protected', pageId: existing.pageId };
      }
      if (!input.force) {
        this.logger.info(
          { date: input.date, pageId: existing.pageId, status: existing.status },
          'worklog page already exists — skip (use --force to recreate)',
        );
        return { kind: 'skipped', reason: 'already-published', pageId: existing.pageId };
      }
      // 새 페이지를 먼저 만들고 그다음 기존 것을 archive — create 실패 시 기존 일지가 보존되도록
      // (이전엔 archive 먼저라 create 가 실패하면 그 날 일지가 소실됐다). archive 가 실패하면
      // 중복 페이지가 잠깐 남지만 데이터 손실은 없음(다음 force 가 최신 것을 잡도록 정렬 보강)
      const createStartedAt = Date.now();
      const created = await this.createPage(input, token, dataSourceId);
      this.logger.info(
        { date: input.date, elapsedMs: Date.now() - createStartedAt },
        'notion publish recreate done',
      );
      try {
        await this.client.archivePage(token, existing.pageId);
      } catch (err) {
        this.logger.warn(
          { date: input.date, oldPageId: existing.pageId, err: String(err) },
          '--force: 새 페이지 생성 후 기존 페이지 archive 실패 — 중복 남을 수 있음(데이터 손실 없음)',
        );
      }
      this.logger.info(
        { date: input.date, totalElapsedMs: Date.now() - startedAt },
        'notion publish done',
      );
      return {
        kind: 'recreated',
        pageId: created.id,
        url: created.url,
        archivedPageId: existing.pageId,
      };
    }

    const createStartedAt = Date.now();
    const created = await this.createPage(input, token, dataSourceId);
    this.logger.info(
      { date: input.date, elapsedMs: Date.now() - createStartedAt },
      'notion publish create done',
    );
    this.logger.info(
      { date: input.date, totalElapsedMs: Date.now() - startedAt },
      'notion publish done',
    );
    return { kind: 'created', pageId: created.id, url: created.url };
  }

  private readonly dbInflight = new Map<
    string,
    Promise<{ databaseId: string; dataSourceId: string }>
  >();

  private async ensureDatabaseAndDataSource(
    target: NotionWorkspaceConfig,
    token: string,
  ): Promise<{ databaseId: string; dataSourceId: string }> {
    const cached = target.worklog;
    if (cached?.databaseId && cached.dataSourceId) {
      return { databaseId: cached.databaseId, dataSourceId: cached.dataSourceId };
    }
    const inflight = this.dbInflight.get(target.label);
    if (inflight) return inflight;
    const promise = this.resolveDatabaseAndDataSource(target, token).finally(() => {
      this.dbInflight.delete(target.label);
    });
    this.dbInflight.set(target.label, promise);
    return promise;
  }

  private async resolveDatabaseAndDataSource(
    target: NotionWorkspaceConfig,
    token: string,
  ): Promise<{ databaseId: string; dataSourceId: string }> {
    const cached = target.worklog;

    if (cached?.databaseId) {
      const dataSourceId = await this.client.getPrimaryDataSourceId(token, cached.databaseId);
      this.worklogConfig.persistWorklogTarget(target.label, {
        databaseId: cached.databaseId,
        dataSourceId,
      });
      return { databaseId: cached.databaseId, dataSourceId };
    }

    if (!cached?.pageId) {
      throw new Error(
        `notionWorkspace ${target.label} has neither worklog.databaseId nor worklog.pageId`,
      );
    }

    this.logger.info(
      { workspace: target.label, parent: cached.pageId },
      'no worklog.databaseId — auto-creating worklog DB',
    );

    const created = await this.client.createWorklogDatabase({
      token,
      parentPageId: cached.pageId,
      title: WORKLOG_DB_TITLE,
    });

    this.worklogConfig.persistWorklogTarget(target.label, {
      databaseId: created.databaseId,
      dataSourceId: created.dataSourceId,
    });
    return { databaseId: created.databaseId, dataSourceId: created.dataSourceId };
  }

  private async createPage(
    input: PublishWorklogInput,
    token: string,
    dataSourceId: string,
  ): Promise<{ id: string; url: string | null }> {
    // fail-closed: 발행 직전 조립 블록에 금지 패턴이 섞이면(모델 입력은 pre-sanitize 되지만 방어선)
    // 위반 블록만 drop 하고 발행 계속 — 전부 drop 이면 fallback 으로 degrade (ADR 0021 item-drop)
    const children = enforceBlockEgress(
      input.summary ? buildSummaryBlocks(input.summary, input) : buildFallbackBlocks(input),
      () => buildFallbackBlocks(input),
      `notion.publish.${input.date}`,
      this.logger,
    );
    this.logger.info(
      {
        date: input.date,
        childrenCount: children.length,
        hasSummary: !!input.summary,
      },
      'notion publish payload prepared',
    );
    const created = await this.client.createWorklogPage({
      token,
      dataSourceId,
      date: input.date,
      title: `${input.date} ${input.lang === 'en' ? 'Worklog' : '작업 일지'}`,
      tags: ['auto', 'daily'],
      children,
    });
    this.logger.info(
      {
        date: input.date,
        pageId: created.id,
        url: created.url,
        hasSummary: !!input.summary,
      },
      'worklog page created',
    );
    return created;
  }
}

// 커밋 시각(ISO) 들의 24칸 시간 히스토그램. 머신 로컬 시간 기준(getHours) — KST 단정 금지(timezone 룰).
export function hourHistogram(isoTimestamps: readonly string[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const iso of isoTimestamps) {
    const h = new Date(iso).getHours();
    if (h >= 0 && h < 24) hours[h]! += 1;
  }
  return hours;
}

function buildSummaryBlocks(
  summary: WorklogSummary,
  input: PublishWorklogInput,
): readonly unknown[] {
  const blocks: unknown[] = [];

  const modelLabel = summaryModelLabel(summary.usage?.model);
  blocks.push(
    claudeCallout(
      input.lang === 'en'
        ? `Auto-generated by cairn · ${modelLabel}`
        : `cairn 이 자동 생성한 일지입니다 · ${modelLabel}`,
    ),
  );

  blocks.push(heading2('Summary'));
  blocks.push(paragraph(summary.paragraph));

  if (summary.shareBullets.length > 0) {
    blocks.push(heading2('Share'));
    blocks.push(...summary.shareBullets.map((t) => bulletItem(t)));
  }

  blocks.push(heading2('Done'));
  blocks.push(...buildDoneBlocks(summary.doneBullets, input.github?.accountLabels ?? []));

  if (summary.reviewedBullets.length > 0) {
    blocks.push(heading2('Reviewed'));
    blocks.push(...summary.reviewedBullets.map((t) => bulletItem(t)));
  }

  if (summary.inProgressBullets.length > 0) {
    blocks.push(heading2('In Progress'));
    blocks.push(...summary.inProgressBullets.map((t) => bulletItem(t)));
  }

  if (summary.notesBullets.length > 0) {
    blocks.push(heading2('Notes'));
    blocks.push(...summary.notesBullets.map((t) => bulletItem(t)));
  }

  if (isOperator() && summary.usage) {
    const u = summary.usage;
    const inK = (u.inputTokens / 1000).toFixed(1);
    const outK = (u.outputTokens / 1000).toFixed(1);
    const cost = u.costUsd.toFixed(4);
    blocks.push(paragraph(`Summarizer usage — ${inK}K in / ${outK}K out / $${cost}`));
  }

  if (isOperator()) {
    blocks.push(buildRawDumpToggle(input));
  }
  return blocks;
}

function buildFallbackBlocks(input: PublishWorklogInput): readonly unknown[] {
  const blocks: unknown[] = [
    claudeCallout(
      input.lang === 'en'
        ? 'Auto-generated by cairn (summarizer skipped or failed).'
        : 'cairn 이 자동 생성한 일지입니다 (Summarizer 미실행 또는 실패).',
    ),
  ];
  if (isOperator()) {
    blocks.push(buildRawDumpToggle(input));
  }
  return blocks;
}

function buildRawDumpToggle(input: PublishWorklogInput): unknown {
  // operator 전용 디버그 덤프도 egress 검사(fail-closed) — 금지 패턴(절대경로·토큰·diff 등,
  // 예: CairnError.message 의 git 에러 경로)이 있으면 통째로 redact 후 발행 계속
  let rawDump: string;
  try {
    assertNoForbiddenPayload({ github: input.github, localGit: input.localGit }, 'notion.rawDump');
    rawDump = JSON.stringify({ github: input.github, localGit: input.localGit }, null, 2);
  } catch {
    rawDump = '[redacted] raw dump contained forbidden content (path/token/diff)';
  }
  const chunks = chunkRawDump(rawDump);
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [
        {
          type: 'text',
          text: { content: input.lang === 'en' ? 'Raw metadata (debug)' : '원본 메타 (디버그)' },
        },
      ],
      children: chunks.map((content) => codeBlock('json', content)),
    },
  };
}

function chunkRawDump(rawDump: string): string[] {
  const chunks: string[] = [];
  for (
    let i = 0;
    i < rawDump.length && chunks.length < RAW_DUMP_MAX_CHUNKS;
    i += RAW_DUMP_CHUNK_SIZE
  ) {
    chunks.push(rawDump.slice(i, i + RAW_DUMP_CHUNK_SIZE));
  }
  if (
    chunks.length === RAW_DUMP_MAX_CHUNKS &&
    rawDump.length > RAW_DUMP_CHUNK_SIZE * RAW_DUMP_MAX_CHUNKS
  ) {
    const last = chunks.length - 1;
    chunks[last] = `${chunks[last]}\n... truncated`;
  }
  return chunks.length > 0 ? chunks : ['{}'];
}

export function buildDoneBlocks(
  bullets: readonly string[],
  accountLabels: readonly string[] = [],
): unknown[] {
  // 단일(또는 0) 계정에선 모든 bullet 이 [repo] 프리픽스만 가진다(계정 라벨 프리픽스 없음).
  // 선행 대괄호를 계정 라벨로 소비하면 [cairn] 같은 repo 프리픽스가 가짜 계정 heading 으로
  // 렌더되고 프리픽스가 사라진다 — 그대로 verbatim 렌더해 프리픽스를 보존한다.
  if (accountLabels.length < 2) {
    if (bullets.length === 0) return [paragraph('—')];
    return bullets.map((t) => bulletItem(t));
  }

  // multi-account: 선행 대괄호가 설정된 계정 라벨과 정확히 일치할 때만 계정 heading 으로 그룹.
  // 대소문자 무시 매칭. [project] 프리픽스(local-git bullet 등)는 라벨 불일치 → ungrouped verbatim.
  const ACCT = /^\[([^\]]+)\]\s*/;
  const accountKeys = new Set(accountLabels.map((a) => a.toLowerCase()));
  const groups = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const b of bullets) {
    const m = ACCT.exec(b);
    if (!m || !accountKeys.has(m[1]!.toLowerCase())) {
      ungrouped.push(b);
      continue;
    }
    const key = m[1]!.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b.slice(m[0].length));
  }

  const out: unknown[] = ungrouped.map((b) => bulletItem(b));
  for (const acct of accountLabels) {
    // 설정 라벨 verbatim — titleCase 는 ldhbenecia→Ldhbenecia, iOS→Ios 로 변형
    out.push(heading3(acct));
    const items = groups.get(acct.toLowerCase()) ?? [];
    if (items.length === 0) out.push(paragraph('None'));
    else for (const text of items) out.push(bulletItem(text));
  }
  return out;
}
