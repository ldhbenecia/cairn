import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isOperator } from '../common/operator.js';
import { summaryModelLabel } from '../common/summary-model.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { enforceBlockEgress } from '../notion/block-egress.js';
import { NotionApiClient } from '../notion/notion-api.client.js';
import { bulletsOrEmpty, claudeCallout, heading2, paragraph } from '../notion/notion-blocks.js';
import { NotionRollupApiClient } from '../notion/notion-rollup-api.client.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { isoWeekLabel, monthLabel, periodRange, yearLabel } from './period-range.js';

const ROLLUP_DB_TITLE = 'Rollup (cairn)';

export interface PublishRollupInput {
  activity: RollupActivity;
  force: boolean;
  summary?: RollupSummary | null;
  lang: WorklogLang;
}

export type PublishRollupResult =
  | { kind: 'created'; pageId: string; url: string | null }
  | { kind: 'recreated'; pageId: string; url: string | null; archivedPageId: string }
  | { kind: 'skipped'; reason: 'already-published' | 'final-protected'; pageId: string }
  | { kind: 'no-target' };

@Injectable()
export class RollupPublisherService {
  constructor(
    private readonly api: NotionApiClient,
    private readonly rollupApi: NotionRollupApiClient,
    private readonly worklogConfig: WorklogConfigService,
    private readonly secrets: SecretsService,
    @InjectPinoLogger(RollupPublisherService.name)
    private readonly logger: PinoLogger,
  ) {}

  // force 실행에선 orchestrator 가 precheck 자체를 건너뛴다 — 여기선 non-force 만 가정
  async precheck(
    period: 'weekly' | 'monthly' | 'yearly',
    localDate: string,
  ): Promise<PublishRollupResult | null> {
    const target = this.worklogConfig.findRollupWorkspace();
    if (!target) return { kind: 'no-target' };

    const token = this.secrets.getEnv(target.tokenEnv);
    if (!token) return { kind: 'no-target' };

    const dataSourceId = target.rollup?.dataSourceId;
    if (!dataSourceId) return null;

    const { start, end } = periodRange(period, localDate);
    try {
      const existing = await this.rollupApi.findRollupPageByRange(
        token,
        dataSourceId,
        period,
        start,
        end,
      );
      if (!existing) return null;
      if (existing.status === 'final') {
        return { kind: 'skipped', reason: 'final-protected', pageId: existing.pageId };
      }
      return { kind: 'skipped', reason: 'already-published', pageId: existing.pageId };
    } catch (err) {
      this.logger.warn(
        { period, err: String(err) },
        'rollup precheck failed — proceeding normally',
      );
      return null;
    }
  }

  async publish(input: PublishRollupInput): Promise<PublishRollupResult> {
    const target = this.worklogConfig.findRollupWorkspace();

    if (!target) {
      this.logger.warn(
        'no notionWorkspace with worklog.pageId — rollup publisher skipped (rollup DB defaults to the same parent page as worklog DB)',
      );
      return { kind: 'no-target' };
    }

    const token = this.secrets.getEnv(target.tokenEnv);
    if (!token) {
      this.logger.warn(
        { workspace: target.label, tokenEnv: target.tokenEnv },
        'rollup publisher: token missing',
      );
      return { kind: 'no-target' };
    }

    const { dataSourceId } = await this.ensureRollupDatabaseAndDataSource(target, token);

    const { activity } = input;
    const existing = await this.rollupApi.findRollupPageByRange(
      token,
      dataSourceId,
      activity.period,
      activity.rangeStart,
      activity.rangeEnd,
    );

    if (existing) {
      if (existing.status === 'final') {
        this.logger.info(
          { period: activity.period, pageId: existing.pageId },
          'rollup page is final — protected from overwrite',
        );
        return { kind: 'skipped', reason: 'final-protected', pageId: existing.pageId };
      }
      if (!input.force) {
        this.logger.info(
          { period: activity.period, pageId: existing.pageId, status: existing.status },
          'rollup page already exists — skip (use --force to recreate)',
        );
        return { kind: 'skipped', reason: 'already-published', pageId: existing.pageId };
      }
      // 새 페이지를 먼저 만들고 그다음 기존 것을 archive — create 실패 시 기존 rollup 이 보존되도록
      // (daily publisher 와 동일 패턴). archive 가 실패하면 중복이 잠깐 남지만 데이터 손실은 없음
      const created = await this.createPage(input, token, dataSourceId);
      try {
        await this.api.archivePage(token, existing.pageId);
        this.logger.info(
          { period: activity.period, archivedPageId: existing.pageId },
          '--force: recreated rollup, archived old draft',
        );
      } catch (err) {
        this.logger.warn(
          { period: activity.period, oldPageId: existing.pageId, err: String(err) },
          '--force: 새 rollup 생성 후 기존 페이지 archive 실패 — 중복 남을 수 있음(데이터 손실 없음)',
        );
      }
      return {
        kind: 'recreated',
        pageId: created.id,
        url: created.url,
        archivedPageId: existing.pageId,
      };
    }

    const created = await this.createPage(input, token, dataSourceId);
    return { kind: 'created', pageId: created.id, url: created.url };
  }

  private async ensureRollupDatabaseAndDataSource(
    target: NotionWorkspaceConfig,
    token: string,
  ): Promise<{ databaseId: string; dataSourceId: string }> {
    const cached = target.rollup;

    if (cached?.databaseId && cached.dataSourceId) {
      return { databaseId: cached.databaseId, dataSourceId: cached.dataSourceId };
    }

    if (cached?.databaseId) {
      const dataSourceId = await this.api.getPrimaryDataSourceId(token, cached.databaseId);
      this.worklogConfig.persistRollupTarget(target.label, {
        databaseId: cached.databaseId,
        dataSourceId,
      });
      return { databaseId: cached.databaseId, dataSourceId };
    }

    const parentPageId = cached?.pageId ?? target.worklog?.pageId;
    if (!parentPageId) {
      throw new Error(
        `notionWorkspace ${target.label} has neither rollup nor worklog parent pageId`,
      );
    }

    this.logger.info(
      {
        workspace: target.label,
        parent: parentPageId,
        source: cached?.pageId ? 'rollup' : 'worklog',
      },
      'no rollup.databaseId — auto-creating rollup DB under parent page',
    );

    const created = await this.rollupApi.createRollupDatabase({
      token,
      parentPageId,
      title: ROLLUP_DB_TITLE,
    });

    this.worklogConfig.persistRollupTarget(target.label, {
      databaseId: created.databaseId,
      dataSourceId: created.dataSourceId,
    });
    return { databaseId: created.databaseId, dataSourceId: created.dataSourceId };
  }

  private async createPage(
    input: PublishRollupInput,
    token: string,
    dataSourceId: string,
  ): Promise<{ id: string; url: string | null }> {
    const { activity, summary, lang } = input;
    const title = buildTitle(activity, lang);
    // 위반 블록만 drop 하고 발행 계속 — 전부 drop 이면 fallback 으로 degrade (ADR 0021 item-drop)
    const children = enforceBlockEgress(
      summary
        ? buildRollupBlocks(summary, activity, lang)
        : buildRollupFallbackBlocks(activity, lang),
      () => buildRollupFallbackBlocks(activity, lang),
      `rollup.publish.${activity.period}.${activity.rangeStart}`,
      this.logger,
    );
    const created = await this.rollupApi.createRollupPage({
      token,
      dataSourceId,
      period: activity.period,
      rangeStart: activity.rangeStart,
      rangeEnd: activity.rangeEnd,
      title,
      tags: ['auto', 'rollup'],
      children,
    });
    this.logger.info(
      {
        period: activity.period,
        rangeStart: activity.rangeStart,
        rangeEnd: activity.rangeEnd,
        pageId: created.id,
        url: created.url,
        hasSummary: !!summary,
      },
      'rollup page created',
    );
    return created;
  }
}

function buildTitle(activity: RollupActivity, lang: WorklogLang): string {
  if (activity.period === 'weekly') {
    const label = isoWeekLabel(activity.rangeStart);
    return lang === 'en' ? `${label} Weekly rollup` : `${label} 주간 정리`;
  }
  if (activity.period === 'monthly') {
    const label = monthLabel(activity.rangeStart);
    return lang === 'en' ? `${label} Monthly rollup` : `${label} 월간 정리`;
  }
  const label = yearLabel(activity.rangeStart);
  return lang === 'en' ? `${label} Yearly rollup` : `${label} 연간 정리`;
}

const PERIOD_WORD: Record<RollupActivity['period'], { ko: string; en: string }> = {
  weekly: { ko: '주간', en: 'weekly' },
  monthly: { ko: '월간', en: 'monthly' },
  yearly: { ko: '연간', en: 'yearly' },
};

function metricsLine(activity: RollupActivity): string {
  const unit = activity.period === 'yearly' ? 'months' : 'dailies';
  return `gh:${activity.metrics.prCount} / git:${activity.metrics.commitCount} / ${unit}:${activity.metrics.dailyCount}`;
}

function buildRollupBlocks(
  summary: RollupSummary,
  activity: RollupActivity,
  lang: WorklogLang,
): readonly unknown[] {
  const blocks: unknown[] = [];
  const period = PERIOD_WORD[activity.period][lang];

  const modelLabel = summaryModelLabel(summary.usage?.model);
  blocks.push(
    claudeCallout(
      lang === 'en'
        ? `Auto-generated ${period} rollup by cairn (${activity.rangeStart} ~ ${activity.rangeEnd}) · ${modelLabel}`
        : `cairn 이 자동 생성한 ${period} 롤업입니다 (${activity.rangeStart} ~ ${activity.rangeEnd}) · ${modelLabel}`,
    ),
  );

  blocks.push(heading2('Summary'));
  blocks.push(paragraph(summary.paragraph));

  if (summary.commentary) {
    blocks.push(heading2('Commentary'));
    blocks.push(paragraph(summary.commentary));
  }

  blocks.push(heading2('Highlights'));
  blocks.push(...bulletsOrEmpty(summary.highlights));

  for (const theme of summary.themes) {
    blocks.push(heading2(theme.title));
    blocks.push(...bulletsOrEmpty(theme.items));
  }

  blocks.push(heading2('Metrics'));
  blocks.push(paragraph(metricsLine(activity)));

  if (isOperator() && summary.usage) {
    const u = summary.usage;
    const inK = (u.inputTokens / 1000).toFixed(1);
    const outK = (u.outputTokens / 1000).toFixed(1);
    const cost = u.costUsd.toFixed(4);
    blocks.push(paragraph(`Rollup summarizer usage — ${inK}K in / ${outK}K out / $${cost}`));
  }

  return blocks;
}

function buildRollupFallbackBlocks(
  activity: RollupActivity,
  lang: WorklogLang,
): readonly unknown[] {
  const period = PERIOD_WORD[activity.period][lang];
  return [
    claudeCallout(
      lang === 'en'
        ? `Auto-generated ${period} rollup by cairn (summarizer skipped or failed).`
        : `cairn 이 자동 생성한 ${period} 롤업 (Summarizer 미실행 또는 실패).`,
    ),
    heading2('Metrics'),
    paragraph(metricsLine(activity)),
  ];
}
