import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isOperator } from '../common/operator.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import { NotionApiClient } from '../notion/notion-api.client.js';
import { NotionRollupApiClient } from '../notion/notion-rollup-api.client.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { isoWeekLabel, monthLabel } from './period-range.js';

const ROLLUP_DB_TITLE = 'Rollup (cairn)';

export interface PublishRollupInput {
  activity: RollupActivity;
  force: boolean;
  summary?: RollupSummary | null;
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

  async publish(input: PublishRollupInput): Promise<PublishRollupResult> {
    const target = this.worklogConfig
      .getNotionWorkspaces()
      .find((ws) => ws.rollup?.pageId ?? ws.worklog?.pageId);

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
      await this.api.archivePage(token, existing.pageId);
      this.logger.info(
        { period: activity.period, archivedPageId: existing.pageId },
        '--force: archived existing draft, recreating',
      );
      const created = await this.createPage(input, token, dataSourceId);
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
    const { activity, summary } = input;
    const title = buildTitle(activity);
    const children = summary
      ? buildRollupBlocks(summary, activity)
      : buildRollupFallbackBlocks(activity);
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

function buildTitle(activity: RollupActivity): string {
  if (activity.period === 'weekly') {
    return `${isoWeekLabel(activity.rangeStart)} 주간 정리`;
  }
  return `${monthLabel(activity.rangeStart)} 월간 정리`;
}

function buildRollupBlocks(summary: RollupSummary, activity: RollupActivity): readonly unknown[] {
  const blocks: unknown[] = [];

  blocks.push(
    callout(
      '🤖',
      `cairn 이 자동 생성한 ${activity.period === 'weekly' ? '주간' : '월간'} 롤업입니다 (${activity.rangeStart} ~ ${activity.rangeEnd}).`,
    ),
  );

  blocks.push(heading2('Summary'));
  blocks.push(paragraph(summary.paragraphKo));

  blocks.push(heading2('Highlights'));
  blocks.push(...bulletsOrEmpty(summary.highlights));

  for (const theme of summary.themes) {
    blocks.push(heading2(theme.title));
    blocks.push(...bulletsOrEmpty(theme.items));
  }

  blocks.push(heading2('Metrics'));
  blocks.push(
    paragraph(
      `gh:${activity.metrics.prCount} / git:${activity.metrics.commitCount} / notion:${activity.metrics.notionPageCount} / dailies:${activity.metrics.dailyCount}`,
    ),
  );

  blocks.push(heading2('Daily pages'));
  blocks.push(...buildDailyRefBullets(activity));

  if (isOperator() && summary.usage) {
    const u = summary.usage;
    const inK = (u.inputTokens / 1000).toFixed(1);
    const outK = (u.outputTokens / 1000).toFixed(1);
    const cost = u.costUsd.toFixed(4);
    blocks.push(callout('🪙', `Rollup summarizer usage — ${inK}K in / ${outK}K out / $${cost}`));
  }

  return blocks;
}

function buildRollupFallbackBlocks(activity: RollupActivity): readonly unknown[] {
  return [
    callout(
      '🤖',
      `cairn 이 자동 생성한 ${activity.period === 'weekly' ? '주간' : '월간'} 롤업 (Summarizer 미실행 또는 실패).`,
    ),
    heading2('Metrics'),
    paragraph(
      `gh:${activity.metrics.prCount} / git:${activity.metrics.commitCount} / notion:${activity.metrics.notionPageCount} / dailies:${activity.metrics.dailyCount}`,
    ),
    heading2('Daily pages'),
    ...buildDailyRefBullets(activity),
  ];
}

function buildDailyRefBullets(activity: RollupActivity): unknown[] {
  if (activity.dailies.length === 0) return [paragraph('—')];
  return activity.dailies.map((d) => {
    const counts = `gh:${d.prCount}/git:${d.commitCount}/notion:${d.notionPageCount}`;
    const link = d.url ? ` → ${d.url}` : '';
    return bulletItem(`${d.date} (${counts})${link}`);
  });
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
