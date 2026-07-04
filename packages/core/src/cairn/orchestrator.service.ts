import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { withConcurrency } from '../common/concurrency.js';
import { computeDayTotals } from '../common/day-totals.js';
import { CairnError } from '../common/error.js';
import { GithubCollectorService } from '../github/github-collector.service.js';
import { LocalGitCollectorService } from '../local-git/local-git-collector.service.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  hourHistogram,
  NotionPublisherService,
  type PublishWorklogResult,
} from '../notion/notion-publisher.service.js';
import { RollupCollectorService } from '../rollup/rollup-collector.service.js';
import {
  RollupPublisherService,
  type PublishRollupResult,
} from '../rollup/rollup-publisher.service.js';
import { RollupSummarizerService } from '../rollup/rollup-summarizer.service.js';
import { periodRange } from '../rollup/period-range.js';
import { DailySummarizerService } from '../summarizer/daily-summarizer.service.js';
import { WorklogStatsService } from '../worklog-stats/worklog-stats.service.js';
import type { RunOptions, RunSource } from './run-options.js';

const BACKFILL_CONCURRENCY = 4;

type DailyStep = 'collect' | 'summarize' | 'publish';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly githubCollector: GithubCollectorService,
    private readonly localGitCollector: LocalGitCollectorService,
    private readonly notionPublisher: NotionPublisherService,
    private readonly summarizer: DailySummarizerService,
    private readonly notification: NotificationService,
    private readonly rollupCollector: RollupCollectorService,
    private readonly rollupSummarizer: RollupSummarizerService,
    private readonly rollupPublisher: RollupPublisherService,
    private readonly stats: WorklogStatsService,
    @InjectPinoLogger(OrchestratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async run(options: RunOptions): Promise<void> {
    this.logger.info({ options }, 'orchestrator.run start');

    try {
      if (options.mode === 'daily') {
        await this.runDaily(options);
      } else {
        await this.runRollup(options.mode, options);
      }
    } catch (err) {
      const error = CairnError.from(err, 'config');
      this.logger.error({ options, error }, 'orchestrator.run failed');
      const failTitle =
        options.mode === 'daily' ? 'cairn 실패' : `cairn ${rollupKor(options.mode)} 실패`;
      const failBody =
        options.mode === 'daily'
          ? `${options.date} 일지 생성 실패 — ${error.message.slice(0, 120)}`
          : `${options.date} ${rollupKor(options.mode)} 생성 실패 — ${error.message.slice(0, 120)}`;
      await this.notification.notify(failTitle, failBody);
      throw err;
    }

    this.logger.info({ options }, 'orchestrator.run done');
  }

  private async runDaily(options: RunOptions): Promise<void> {
    if (options.dateExplicit || options.backfillDays === 0 || options.dryRun) {
      await this.runDailyForDate(options.date, options, { silent: false });
      return;
    }

    const targetDates = generatePastDates(options.date, options.backfillDays);
    const rangeStart = targetDates[0]!;
    const rangeEnd = targetDates[targetDates.length - 1]!;
    const published = options.force
      ? new Set<string>()
      : await this.notionPublisher.findPublishedDates(rangeStart, rangeEnd);
    const missingDates = options.force ? targetDates : targetDates.filter((d) => !published.has(d));

    if (missingDates.length === 0) {
      this.logger.info(
        { rangeStart, rangeEnd, checked: targetDates.length },
        'daily: all dates in backfill window already published — nothing to do',
      );
      return;
    }

    if (missingDates.length === 1) {
      await this.runDailyForDate(missingDates[0]!, options, { silent: false });
      return;
    }

    this.logger.info(
      { missingDates, alreadyPublishedCount: targetDates.length - missingDates.length },
      'daily: backfill — multiple missing dates detected',
    );

    let backfillDone = 0;
    const completedDates: string[] = [];
    const backfillTotal = missingDates.length;
    // 데스크톱 배치 진행 UI 가 시작 즉시 총개수·날짜 목록을 알도록(완료 로그 전부터 날짜별 행 렌더링)
    this.logger.info(
      { total: backfillTotal, dates: missingDates.join(',') },
      'daily: backfill batch start',
    );
    const results = await withConcurrency<
      string,
      { date: string; kind: PublishWorklogResult['kind'] | 'no-activity' | 'failed' }
    >(missingDates, BACKFILL_CONCURRENCY, async (date) => {
      // 날짜별 "시작" — 요약 중(완료 전)에도 동시 처리 중인 칸 펄스 표시
      this.logger.info({ date }, 'daily: backfill date start');
      let result: { date: string; kind: PublishWorklogResult['kind'] | 'no-activity' | 'failed' };
      try {
        const outcome = await this.runDailyForDate(date, options, {
          silent: true,
          precheck: false,
          onStep: (step) => this.logger.info({ date, step }, 'daily: backfill date step'),
        });
        result = { date, kind: outcome };
      } catch (err) {
        const error = CairnError.from(err, 'config');
        this.logger.error({ date, error }, 'daily: backfill date failed — continuing batch');
        result = { date, kind: 'failed' };
      }
      backfillDone += 1;
      completedDates.push(date);
      // doneDates: 완료 순서가 날짜 순서와 달라도 UI 가 멤버십으로 정확히 상태 판정하도록 누적 목록 전달
      this.logger.info(
        { date, done: backfillDone, total: backfillTotal, doneDates: completedDates.join(',') },
        'daily: backfill progress',
      );
      return result;
    });

    await this.notifyBackfillBatch(missingDates, results);
  }

  private async runDailyForDate(
    date: string,
    options: RunOptions,
    opts: { silent: boolean; precheck?: boolean; onStep?: (step: DailyStep) => void },
  ): Promise<PublishWorklogResult['kind'] | 'no-activity'> {
    const wantsGithub = wantsSource(options.sources, 'github');
    const wantsLocalGit = wantsSource(options.sources, 'local-git');

    if (!wantsGithub && !wantsLocalGit) {
      this.logger.warn({ sources: options.sources }, 'daily: no enabled source — skipping');
      return 'no-activity';
    }

    if (!options.dryRun && !options.force && opts.precheck !== false) {
      const pre = await this.notionPublisher.precheckDaily(date);
      if (pre) {
        this.logger.info(
          { date, publishResult: pre },
          'daily: precheck short-circuit — skip collect/summarize',
        );
        if (!opts.silent) {
          await this.notify(date, pre, {
            prCount: 0,
            commitCount: 0,
            summarizerOk: false,
          });
        }
        return pre.kind;
      }
    }

    opts.onStep?.('collect');
    const collectStart = Date.now();
    const [githubActivity, localGitActivity] = await Promise.all([
      wantsGithub
        ? this.githubCollector.collect(date, options.lookbackDays)
        : Promise.resolve(null),
      wantsLocalGit ? this.localGitCollector.collect(date) : Promise.resolve(null),
    ]);
    const collectMs = Date.now() - collectStart;

    if (options.dryRun) {
      if (githubActivity) {
        process.stdout.write('--- github activity (dry-run) ---\n');
        process.stdout.write(JSON.stringify(githubActivity, null, 2));
        process.stdout.write('\n');
      }
      if (localGitActivity) {
        process.stdout.write('--- local-git activity (dry-run) ---\n');
        process.stdout.write(JSON.stringify(localGitActivity, null, 2));
        process.stdout.write('\n');
      }
      return 'no-activity';
    }

    const { prCount, commitCount } = computeDayTotals(githubActivity, localGitActivity);

    if (prCount + commitCount === 0) {
      this.logger.info({ date }, 'daily: no activity collected — skipping summarizer + publisher');
      if (!opts.silent) {
        await this.notification.notify('cairn 일지', `${date} 활동 없음 — 일지 생략`);
      }
      return 'no-activity';
    }

    // 그랜드 토탈(로컬+GitHub PR dedup)을 요약 전에 한 번 — 발행 진행 UI 칩이
    // local-git collect 의 로컬-온리 수치 대신 실제 합계를 표시하도록
    this.logger.info({ date, prCount, commitCountTotal: commitCount }, 'daily: day totals');

    opts.onStep?.('summarize');
    const summarizeStart = Date.now();
    const summary = await this.summarizer.summarize(
      {
        date,
        github: githubActivity,
        localGit: localGitActivity,
      },
      options.lang,
    );
    const summarizeMs = Date.now() - summarizeStart;

    // 요약 실패(Claude 세션 만료·쿼터 소진·중단 등)면 발행 안 함 — 빈 fallback 페이지를
    // '성공'으로 만들어 가짜 발행이 남던 문제 방지, 발행 전에 던져 기존 페이지도 안 건드림
    if (!summary) {
      this.logger.warn({ date }, 'daily: summary generation failed — aborting publish');
      throw CairnError.from(
        new Error('요약 생성 실패 — Claude 세션/쿼터를 확인한 뒤 다시 발행하세요'),
        'summarizer',
      );
    }

    opts.onStep?.('publish');
    const publishStart = Date.now();
    const result = await this.notionPublisher.publish({
      date,
      force: options.force,
      github: githubActivity,
      localGit: localGitActivity,
      summary,
      lang: options.lang,
    });
    const publishMs = Date.now() - publishStart;

    // 통계는 노션이 아닌 로컬에 기록(진실 소스). pr·commit 은 위 distinct 총량과 동일,
    // hours=커밋 시각 24칸 히스토그램(머신 로컬 TZ, SHA 중복 제거)
    if (result.kind === 'created' || result.kind === 'recreated') {
      const seen = new Set<string>();
      const stamps: string[] = [];
      for (const repo of localGitActivity?.repos ?? []) {
        for (const c of repo.commits) {
          if (!seen.has(c.shortSha)) {
            seen.add(c.shortSha);
            stamps.push(c.authoredAt);
          }
        }
      }
      for (const pr of githubActivity?.prs ?? []) {
        for (const c of pr.commitsOnDate) {
          if (!seen.has(c.shortSha)) {
            seen.add(c.shortSha);
            stamps.push(c.authoredAt);
          }
        }
      }
      this.stats.record('daily', date, {
        pr: prCount,
        commit: commitCount,
        hours: hourHistogram(stamps),
      });
    }

    this.logger.info(
      {
        date,
        prCount,
        commitCountTotal: commitCount,
        summarizerOk: !!summary,
        publishResult: result,
        timingMs: { collect: collectMs, summarize: summarizeMs, publish: publishMs },
      },
      'daily: publish done',
    );

    if (!opts.silent) {
      await this.notify(date, result, {
        prCount,
        commitCount,
        summarizerOk: !!summary,
      });
    }
    return result.kind;
  }

  private async notifyBackfillBatch(
    missingDates: readonly string[],
    results: ReadonlyArray<{
      date: string;
      kind: PublishWorklogResult['kind'] | 'no-activity' | 'failed';
    }>,
  ): Promise<void> {
    const created = results.filter((r) => r.kind === 'created' || r.kind === 'recreated').length;
    const skipped = results.filter((r) => r.kind === 'skipped').length;
    const noActivity = results.filter((r) => r.kind === 'no-activity').length;
    const noTarget = results.filter((r) => r.kind === 'no-target').length;
    const failed = results.filter((r) => r.kind === 'failed').length;

    const first = missingDates[0]!;
    const last = missingDates[missingDates.length - 1]!;
    const range = first === last ? first : `${first} ~ ${last}`;

    const parts: string[] = [];
    if (created > 0) parts.push(`발행 ${created}`);
    if (skipped > 0) parts.push(`skip ${skipped}`);
    if (noActivity > 0) parts.push(`활동 없음 ${noActivity}`);
    if (noTarget > 0) parts.push(`설정 누락 ${noTarget}`);
    if (failed > 0) parts.push(`실패 ${failed}`);

    await this.notification.notify(
      'cairn 일지',
      `${missingDates.length} 일 backfill 완료 (${range}) — ${parts.join(' / ')}`,
    );
  }

  private async notify(
    date: string,
    result: PublishWorklogResult,
    counts: {
      prCount: number;
      commitCount: number;
      summarizerOk: boolean;
    },
  ): Promise<void> {
    const counts_label = `gh:${counts.prCount} / git:${counts.commitCount}`;
    const summary_tag = counts.summarizerOk ? '' : ' [요약 실패]';

    if (result.kind === 'created') {
      await this.notification.notify('cairn 일지', `${date} 발행 (${counts_label})${summary_tag}`);
    } else if (result.kind === 'recreated') {
      await this.notification.notify(
        'cairn 일지',
        `${date} 재발행 (${counts_label})${summary_tag}`,
      );
    } else if (result.kind === 'skipped') {
      await this.notification.notify(
        'cairn 일지',
        `${date} skip — ${result.reason} (--force 로 재생성)`,
      );
    } else if (result.kind === 'no-target') {
      await this.notification.notify(
        'cairn 설정 필요',
        `${date} 발행 대상 없음 — worklog.config.json 의 worklog.pageId 또는 token 확인`,
      );
    }
  }

  private async runRollup(period: 'weekly' | 'monthly', options: RunOptions): Promise<void> {
    if (!options.dryRun && !options.force) {
      const pre = await this.rollupPublisher.precheck(period, options.date);
      if (pre) {
        const { start, end } = periodRange(period, options.date);
        this.logger.info(
          { period, rangeStart: start, rangeEnd: end, publishResult: pre },
          'rollup: precheck short-circuit — skip collect/summarize',
        );
        await this.notifyRollup(period, start, end, pre, false);
        return;
      }
    }

    const activity = await this.rollupCollector.collect(period, options.date);
    const periodKor = rollupKor(period);
    const titleKor = `cairn ${periodKor}`;

    if (options.dryRun) {
      process.stdout.write(`--- rollup activity (dry-run, ${period}) ---\n`);
      process.stdout.write(JSON.stringify(activity, null, 2));
      process.stdout.write('\n');
      return;
    }

    if (activity.metrics.dailyCount === 0) {
      this.logger.info(
        { period, rangeStart: activity.rangeStart, rangeEnd: activity.rangeEnd },
        'rollup: no daily pages in range — skipping summarizer + publisher',
      );
      await this.notification.notify(
        titleKor,
        `${activity.rangeStart} ~ ${activity.rangeEnd} 일지 없음 — ${periodKor} 생략`,
      );
      return;
    }

    const summary = await this.rollupSummarizer.summarize({ activity }, options.lang);

    if (!summary) {
      this.logger.warn(
        { period: activity.period, rangeStart: activity.rangeStart },
        'rollup: summary generation failed — aborting publish',
      );
      throw CairnError.from(
        new Error('롤업 요약 생성 실패 — Claude 세션/쿼터를 확인한 뒤 다시 발행하세요'),
        'summarizer',
      );
    }

    const result = await this.rollupPublisher.publish({
      activity,
      force: options.force,
      summary,
      lang: options.lang,
    });

    this.logger.info(
      {
        period,
        rangeStart: activity.rangeStart,
        rangeEnd: activity.rangeEnd,
        ...activity.metrics,
        summarizerOk: !!summary,
        publishResult: result,
      },
      'rollup: publish done',
    );

    await this.notifyRollup(period, activity.rangeStart, activity.rangeEnd, result, !!summary);
  }

  private async notifyRollup(
    period: 'weekly' | 'monthly',
    rangeStart: string,
    rangeEnd: string,
    result: PublishRollupResult,
    summarizerOk: boolean,
  ): Promise<void> {
    const titleKor = `cairn ${rollupKor(period)}`;
    const range = `${rangeStart} ~ ${rangeEnd}`;
    const summary_tag = summarizerOk ? '' : ' [요약 실패]';

    if (result.kind === 'created') {
      await this.notification.notify(titleKor, `${range} 발행${summary_tag}`);
    } else if (result.kind === 'recreated') {
      await this.notification.notify(titleKor, `${range} 재발행${summary_tag}`);
    } else if (result.kind === 'skipped') {
      await this.notification.notify(
        titleKor,
        `${range} skip — ${result.reason} (--force 로 재생성)`,
      );
    } else if (result.kind === 'no-target') {
      await this.notification.notify(
        'cairn 설정 필요',
        `${range} 롤업 대상 없음 — worklog.config.json 의 worklog.pageId 또는 token 확인`,
      );
    }
  }
}

function wantsSource(sources: RunOptions['sources'], source: RunSource): boolean {
  return sources === 'all' || sources.includes(source);
}

function rollupKor(period: 'weekly' | 'monthly'): string {
  return period === 'weekly' ? '주간 정리' : '월간 정리';
}

function generatePastDates(today: string, days: number): string[] {
  const parts = today.split('-').map(Number);
  const [y, m, d] = parts;
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`invalid today: ${today}`);
  }
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}
