import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { withConcurrency } from '../common/concurrency.js';
import { CairnError } from '../common/error.js';
import type {
  RollupActivity,
  RollupDailyPageMeta,
  RollupDailySummaryText,
  RollupMetrics,
  RollupPeriod,
} from '../contracts/rollup-activity.types.js';
import { NotionApiClient } from '../notion/notion-api.client.js';
import type { ExtractedBlock, WorklogPageInRange } from '../notion/notion-api.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { periodRange } from './period-range.js';

interface ParsedSourceCounts {
  prCount: number;
  commitCount: number;
  notionPageCount: number;
}

interface ParsedSummaryText {
  paragraphKo: string;
  doneBullets: string[];
  reviewedBullets: string[];
  inProgressBullets: string[];
  notesBullets: string[];
}

@Injectable()
export class RollupCollectorService {
  constructor(
    private readonly api: NotionApiClient,
    private readonly worklogConfig: WorklogConfigService,
    private readonly secrets: SecretsService,
    @InjectPinoLogger(RollupCollectorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async collect(period: RollupPeriod, kstDate: string): Promise<RollupActivity> {
    const { start, end } = periodRange(period, kstDate);
    const target = this.findTarget();

    if (!target) {
      this.logger.warn('no notionWorkspace with worklog.dataSourceId — rollup collector skipped');
      return emptyActivity(period, start, end);
    }

    const token = this.secrets.getEnv(target.tokenEnv);
    if (!token) {
      this.logger.warn(
        { workspace: target.label, tokenEnv: target.tokenEnv },
        'rollup collector: token missing',
      );
      return {
        ...emptyActivity(period, start, end),
        error: CairnError.notionTokenMissing(target.tokenEnv),
      };
    }

    const dataSourceId = target.worklog?.dataSourceId;
    if (!dataSourceId) {
      this.logger.warn(
        { workspace: target.label },
        'rollup collector: worklog.dataSourceId not set — daily DB likely never created',
      );
      return emptyActivity(period, start, end);
    }

    this.logger.info(
      { period, workspace: target.label, rangeStart: start, rangeEnd: end },
      'rollup collect start',
    );

    let pages: readonly WorklogPageInRange[];
    try {
      pages = await this.api.queryWorklogPagesInRange(token, dataSourceId, start, end);
    } catch (err) {
      const error = CairnError.from(err, 'notion');
      this.logger.warn({ error }, 'rollup collect: query failed');
      return { ...emptyActivity(period, start, end), error };
    }

    const dailies: RollupDailyPageMeta[] = [];
    const summaries: RollupDailySummaryText[] = [];
    let prTotal = 0;
    let commitTotal = 0;
    let notionTotal = 0;

    const parsedSummaries = await withConcurrency(pages, 4, async (page) => {
      const counts = parseSourceCounts(page.sourceCounts);
      const daily: RollupDailyPageMeta = {
        date: page.date,
        pageId: page.pageId,
        url: page.url ?? '',
        prCount: counts.prCount,
        commitCount: counts.commitCount,
        notionPageCount: counts.notionPageCount,
      };
      prTotal += counts.prCount;
      commitTotal += counts.commitCount;
      notionTotal += counts.notionPageCount;

      try {
        const blocks = await this.api.getPageBlocks(token, page.pageId);
        const parsed = parseSummaryFromBlocks(blocks);
        return { daily, summary: parsed ? { date: page.date, ...parsed } : null };
      } catch (err) {
        this.logger.warn(
          { date: page.date, error: CairnError.from(err, 'notion') },
          'rollup collect: page body fetch failed — skipping summary text for this day',
        );
        return { daily, summary: null };
      }
    });

    for (const item of parsedSummaries) {
      dailies.push(item.daily);
      if (item.summary) summaries.push(item.summary);
    }

    const metrics: RollupMetrics = {
      prCount: prTotal,
      commitCount: commitTotal,
      notionPageCount: notionTotal,
      dailyCount: dailies.length,
    };

    this.logger.info(
      { period, rangeStart: start, rangeEnd: end, ...metrics, summariesParsed: summaries.length },
      'rollup collect done',
    );

    return { period, rangeStart: start, rangeEnd: end, dailies, summaries, metrics };
  }

  private findTarget(): NotionWorkspaceConfig | undefined {
    return this.worklogConfig.getNotionWorkspaces().find((ws) => ws.worklog?.dataSourceId);
  }
}

function emptyActivity(period: RollupPeriod, start: string, end: string): RollupActivity {
  return {
    period,
    rangeStart: start,
    rangeEnd: end,
    dailies: [],
    summaries: [],
    metrics: { prCount: 0, commitCount: 0, notionPageCount: 0, dailyCount: 0 },
  };
}

export function parseSourceCounts(text: string): ParsedSourceCounts {
  const out = { prCount: 0, commitCount: 0, notionPageCount: 0 };
  const matches = text.matchAll(/(gh|git|notion)\s*:\s*(\d+)/gi);
  for (const m of matches) {
    const key = m[1]?.toLowerCase();
    const num = Number(m[2] ?? 0);
    if (key === 'gh') out.prCount = num;
    else if (key === 'git') out.commitCount = num;
    else if (key === 'notion') out.notionPageCount = num;
  }
  return out;
}

export function parseSummaryFromBlocks(
  blocks: readonly ExtractedBlock[],
): ParsedSummaryText | null {
  let paragraphKo = '';
  const doneBullets: string[] = [];
  const reviewedBullets: string[] = [];
  const inProgressBullets: string[] = [];
  const notesBullets: string[] = [];

  let section: 'summary' | 'done' | 'reviewed' | 'inprogress' | 'notes' | null = null;
  let pickedSummaryParagraph = false;

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      section = headingToSection(block.text);
      continue;
    }
    if (!section) continue;
    if (block.type === 'paragraph' && section === 'summary' && !pickedSummaryParagraph) {
      const text = block.text.trim();
      if (text && text !== '—') {
        paragraphKo = text;
        pickedSummaryParagraph = true;
      }
      continue;
    }
    if (block.type === 'bulleted_list_item') {
      const text = block.text.trim();
      if (!text) continue;
      if (section === 'done') doneBullets.push(text);
      else if (section === 'reviewed') reviewedBullets.push(text);
      else if (section === 'inprogress') inProgressBullets.push(text);
      else if (section === 'notes') notesBullets.push(text);
    }
  }

  if (
    !paragraphKo &&
    doneBullets.length === 0 &&
    reviewedBullets.length === 0 &&
    inProgressBullets.length === 0 &&
    notesBullets.length === 0
  ) {
    return null;
  }
  return { paragraphKo, doneBullets, reviewedBullets, inProgressBullets, notesBullets };
}

function headingToSection(
  text: string,
): 'summary' | 'done' | 'reviewed' | 'inprogress' | 'notes' | null {
  const lc = text.toLowerCase().trim();
  if (lc === 'summary') return 'summary';
  if (lc === 'done') return 'done';
  if (lc === 'reviewed') return 'reviewed';
  if (lc === 'in progress') return 'inprogress';
  if (lc === 'notes') return 'notes';
  return null;
}
