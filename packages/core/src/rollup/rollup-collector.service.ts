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
import { JournalSourceService } from '../journal/journal-source.service.js';
import { NotionApiClient } from '../notion/notion-api.client.js';
import type { ExtractedBlock, WorklogPageInRange } from '../notion/notion-api.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { WorklogStatsService } from '../worklog-stats/worklog-stats.service.js';
import { periodRange } from './period-range.js';

interface ParsedSummaryText {
  paragraph: string;
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
    private readonly stats: WorklogStatsService,
    private readonly journalSource: JournalSourceService,
    @InjectPinoLogger(RollupCollectorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async collect(period: RollupPeriod, localDate: string): Promise<RollupActivity> {
    const { start, end } = periodRange(period, localDate);
    const target = this.findTarget();

    if (!target) {
      this.logger.info('no notion workspace — rollup collects from local journal');
      return this.collectFromJournal(period, start, end);
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
        'rollup collector: worklog.dataSourceId not set — collecting from local journal',
      );
      return this.collectFromJournal(period, start, end);
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

    // 같은 날짜의 daily 페이지가 둘 이상이면(재발행 경합 등) 메트릭·요약 입력이 이중 집계되던 문제.
    // 날짜당 하나만 — 최근 편집분 우선(내림차순 정렬돼 있으므로 첫 등장 유지)
    const dedupedPages = dedupeByDate(pages);
    if (dedupedPages.length !== pages.length) {
      this.logger.warn(
        { period, raw: pages.length, deduped: dedupedPages.length },
        'rollup: duplicate daily pages for same date — deduped',
      );
    }
    pages = dedupedPages;

    this.logger.info(
      { period, dailyCount: pages.length, dailyDates: pages.map((p) => p.date) },
      'rollup dailies',
    );

    const dailies: RollupDailyPageMeta[] = [];
    const summaries: RollupDailySummaryText[] = [];
    let prTotal = 0;
    let commitTotal = 0;

    // 통계 진실 소스는 로컬(노션 Source counts 제거됨).
    const localStats = this.stats.readAll();
    const parsedSummaries = await withConcurrency(pages, 4, async (page) => {
      const stat = localStats[`daily:${page.date}`] ?? { pr: 0, commit: 0 };
      const daily: RollupDailyPageMeta = {
        date: page.date,
        pageId: page.pageId,
        url: page.url ?? '',
        prCount: stat.pr,
        commitCount: stat.commit,
      };
      prTotal += stat.pr;
      commitTotal += stat.commit;

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
      dailyCount: dailies.length,
    };

    this.logger.info(
      { period, rangeStart: start, rangeEnd: end, ...metrics, summariesParsed: summaries.length },
      'rollup collect done',
    );

    return { period, rangeStart: start, rangeEnd: end, dailies, summaries, metrics };
  }

  private findTarget(): NotionWorkspaceConfig | undefined {
    // 발행 target 과 같은 워크스페이스에서 daily 를 읽는다 (미연동이면 로컬 journal 수집)
    return this.worklogConfig.findRollupWorkspace();
  }

  // 노션 미연동 상태의 롤업 — 로컬 journal 의 daily md 에서 같은 구조로 수집 (ADR 0031)
  private collectFromJournal(period: RollupPeriod, start: string, end: string): RollupActivity {
    const entries = this.journalSource.listDailyEntries(start, end);
    const localStats = this.stats.readAll();

    const dailies: RollupDailyPageMeta[] = [];
    const summaries: RollupDailySummaryText[] = [];
    let prTotal = 0;
    let commitTotal = 0;

    for (const entry of entries) {
      const stat = localStats[`daily:${entry.date}`] ?? { pr: 0, commit: 0 };
      dailies.push({
        date: entry.date,
        pageId: `journal:${entry.fileName}`,
        url: '',
        prCount: stat.pr,
        commitCount: stat.commit,
      });
      prTotal += stat.pr;
      commitTotal += stat.commit;
      const parsed = parseSummaryFromBlocks(entry.blocks);
      if (parsed) summaries.push({ date: entry.date, ...parsed });
    }

    const metrics: RollupMetrics = {
      prCount: prTotal,
      commitCount: commitTotal,
      dailyCount: dailies.length,
    };
    this.logger.info(
      { period, rangeStart: start, rangeEnd: end, ...metrics, summariesParsed: summaries.length },
      'rollup collect done (journal)',
    );
    return { period, rangeStart: start, rangeEnd: end, dailies, summaries, metrics };
  }
}

function emptyActivity(period: RollupPeriod, start: string, end: string): RollupActivity {
  return {
    period,
    rangeStart: start,
    rangeEnd: end,
    dailies: [],
    summaries: [],
    metrics: { prCount: 0, commitCount: 0, dailyCount: 0 },
  };
}

// 날짜당 첫 등장만 유지 (정렬이 최근순이면 최신 편집분 우선). 재발행 경합으로 같은 날짜
// 페이지가 둘 이상일 때 메트릭·요약 이중 집계 방지
export function dedupeByDate<T extends { date: string }>(pages: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of pages) {
    if (seen.has(p.date)) continue;
    seen.add(p.date);
    out.push(p);
  }
  return out;
}

export function parseSummaryFromBlocks(
  blocks: readonly ExtractedBlock[],
): ParsedSummaryText | null {
  let paragraph = '';
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
        paragraph = text;
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
    !paragraph &&
    doneBullets.length === 0 &&
    reviewedBullets.length === 0 &&
    inProgressBullets.length === 0 &&
    notesBullets.length === 0
  ) {
    return null;
  }
  return { paragraph, doneBullets, reviewedBullets, inProgressBullets, notesBullets };
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
