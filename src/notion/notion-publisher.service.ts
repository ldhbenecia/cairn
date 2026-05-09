import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isOperator } from '../common/operator.js';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import type { NotionActivity } from '../contracts/notion-activity.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { NotionApiClient } from './notion-api.client.js';

const WORKLOG_DB_TITLE = 'Daily Worklog (cairn)';

export interface PublishWorklogInput {
  date: string;
  force: boolean;
  github: GithubActivity | null;
  localGit: LocalGitActivity | null;
  notion: NotionActivity | null;
  summary?: WorklogSummary | null;
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

  async publish(input: PublishWorklogInput): Promise<PublishWorklogResult> {
    const target = this.worklogConfig.getNotionWorkspaces().find((ws) => ws.worklog?.pageId);

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

    const { dataSourceId } = await this.ensureDatabaseAndDataSource(target, token);

    const existing = await this.client.findWorklogPageByDate(token, dataSourceId, input.date);
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
      await this.client.archivePage(token, existing.pageId);
      this.logger.info(
        { date: input.date, archivedPageId: existing.pageId },
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
    const created = await this.client.createWorklogPage({
      token,
      dataSourceId,
      date: input.date,
      title: `${input.date} 작업 일지`,
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
  const notion = input.notion?.workspaces.reduce((acc, w) => acc + w.pageCount, 0) ?? 0;
  return `gh:${gh} / git:${git} / notion:${notion}`;
}

function buildSummaryBlocks(
  summary: WorklogSummary,
  input: PublishWorklogInput,
): readonly unknown[] {
  const blocks: unknown[] = [];

  blocks.push(callout('🤖', 'cairn 이 자동 생성한 한국어 일지입니다.'));

  blocks.push(heading2('Summary'));
  blocks.push(paragraph(summary.paragraphKo));

  blocks.push(heading2('Done'));
  blocks.push(...bulletsOrEmpty(summary.doneBullets));

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

  blocks.push(buildRawDumpToggle(input));
  return blocks;
}

function buildFallbackBlocks(input: PublishWorklogInput): readonly unknown[] {
  return [
    callout(
      '🤖',
      'cairn 이 자동 생성한 일지입니다 (Summarizer 미실행 또는 실패). raw 메타 dump 만 포함.',
    ),
    buildRawDumpToggle(input),
  ];
}

function buildRawDumpToggle(input: PublishWorklogInput): unknown {
  const rawDump = JSON.stringify(
    { github: input.github, localGit: input.localGit, notion: input.notion },
    null,
    2,
  );
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [{ type: 'text', text: { content: '원본 메타 (디버그)' } }],
      children: [
        {
          object: 'block',
          type: 'code',
          code: {
            language: 'json',
            rich_text: [{ type: 'text', text: { content: rawDump.slice(0, 1900) } }],
          },
        },
      ],
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
