import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { WorklogLang } from '../cairn/run-options.js';
import { CLAUDE_ICON_URL } from '../common/branding.js';
import { isOperator } from '../common/operator.js';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { NotionApiClient } from './notion-api.client.js';

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
    const target = this.worklogConfig.getNotionWorkspaces().find((ws) => ws.worklog?.pageId);
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

  /**
   * 수집·요약 전에 미리 확인해서 어차피 skip 될 경우 빠르게 단락(short-circuit)한다.
   * - 발행 대상(worklog.pageId / token) 없음 → no-target
   * - 이미 발행됨(force X) / final 보호 → skipped
   * - 그 외(신규 발행해야 함 / dataSourceId 미생성 / 확인 실패) → null (정상 진행)
   */
  async precheckDaily(date: string, force: boolean): Promise<PublishWorklogResult | null> {
    const target = this.worklogConfig.getNotionWorkspaces().find((ws) => ws.worklog?.pageId);
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
      if (!force) {
        return { kind: 'skipped', reason: 'already-published', pageId: existing.pageId };
      }
      return null;
    } catch (err) {
      this.logger.warn({ date, err: String(err) }, 'precheckDaily failed — proceeding normally');
      return null;
    }
  }

  async publish(input: PublishWorklogInput): Promise<PublishWorklogResult> {
    const target = this.worklogConfig.getNotionWorkspaces().find((ws) => ws.worklog?.pageId);
    const startedAt = Date.now();

    this.logger.info({ date: input.date, force: input.force }, 'notion publish start');

    if (!target) {
      this.logger.warn(
        'no notionWorkspace with worklog.pageId — publisher skipped (set worklog.pageId in worklog.config.json)',
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
      const archiveStartedAt = Date.now();
      await this.client.archivePage(token, existing.pageId);
      this.logger.info(
        {
          date: input.date,
          archivedPageId: existing.pageId,
          elapsedMs: Date.now() - archiveStartedAt,
        },
        '--force: archived existing draft, recreating',
      );
      const createStartedAt = Date.now();
      const created = await this.createPage(input, token, dataSourceId);
      this.logger.info(
        { date: input.date, elapsedMs: Date.now() - createStartedAt },
        'notion publish recreate done',
      );
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

  private async ensureDatabaseAndDataSource(
    target: NotionWorkspaceConfig,
    token: string,
  ): Promise<{ databaseId: string; dataSourceId: string }> {
    const cached = target.worklog;

    if (cached?.databaseId && cached.dataSourceId) {
      return { databaseId: cached.databaseId, dataSourceId: cached.dataSourceId };
    }

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
    const sourceCounts = formatSourceCounts(input);
    const children = input.summary
      ? buildSummaryBlocks(input.summary, input)
      : buildFallbackBlocks(input);
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
      sourceCounts,
      tags: ['auto', 'daily'],
      children,
    });
    this.logger.info(
      {
        date: input.date,
        pageId: created.id,
        url: created.url,
        sourceCounts,
        hasSummary: !!input.summary,
      },
      'worklog page created',
    );
    return created;
  }
}

function formatSourceCounts(input: PublishWorklogInput): string {
  const gh = input.github?.prs.length ?? 0;
  const git = input.localGit?.repos.reduce((acc, r) => acc + r.commitCount, 0) ?? 0;
  return `gh:${gh} / git:${git}`;
}

function buildSummaryBlocks(
  summary: WorklogSummary,
  input: PublishWorklogInput,
): readonly unknown[] {
  const blocks: unknown[] = [];

  blocks.push(
    claudeCallout(
      input.lang === 'en' ? 'Auto-generated by cairn.' : 'cairn 이 자동 생성한 일지입니다.',
    ),
  );

  blocks.push(heading2('Summary'));
  blocks.push(paragraph(summary.paragraphKo));

  blocks.push(heading2('Done'));
  blocks.push(...bulletsOrEmpty(summary.doneBullets));

  blocks.push(heading2('Reviewed'));
  blocks.push(...bulletsOrEmpty(summary.reviewedBullets));

  blocks.push(heading2('In Progress'));
  blocks.push(...bulletsOrEmpty(summary.inProgressBullets));

  blocks.push(heading2('Notes'));
  blocks.push(...bulletsOrEmpty(summary.notesBullets));

  if (isOperator() && summary.usage) {
    const u = summary.usage;
    const inK = (u.inputTokens / 1000).toFixed(1);
    const outK = (u.outputTokens / 1000).toFixed(1);
    const cost = u.costUsd.toFixed(4);
    blocks.push(callout('🪙', `Summarizer usage — ${inK}K in / ${outK}K out / $${cost}`));
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
  const rawDump = JSON.stringify({ github: input.github, localGit: input.localGit }, null, 2);
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

function claudeCallout(text: string): unknown {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'external', external: { url: CLAUDE_ICON_URL } },
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function callout(emoji: string, text: string): unknown {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji },
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function heading2(text: string): unknown {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function paragraph(text: string): unknown {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function codeBlock(language: string, content: string): unknown {
  return {
    object: 'block',
    type: 'code',
    code: {
      language,
      rich_text: [{ type: 'text', text: { content } }],
    },
  };
}

function bulletItem(text: string): unknown {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function bulletsOrEmpty(items: readonly string[]): unknown[] {
  if (items.length === 0) return [paragraph('—')];
  return items.map((t) => bulletItem(t));
}
