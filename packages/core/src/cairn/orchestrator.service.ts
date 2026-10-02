import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { withConcurrency } from '../common/concurrency.js';
import { collectSourceErrors, computeDayTotals, shaKey } from '../common/day-totals.js';
import { CairnError } from '../common/error.js';
import { emitParentEvent } from '../common/parent-events.js';
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
import { addDaysIso, periodRange } from '../rollup/period-range.js';
import { DailySummarizerService } from '../summarizer/daily-summarizer.service.js';
import { JournalSourceService } from '../journal/journal-source.service.js';
import { JournalWriterService } from '../journal/journal-writer.service.js';
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
    private readonly journalWriter: JournalWriterService,
    private readonly journalSource: JournalSourceService,
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
      const label = options.mode === 'daily' ? '일지' : rollupKor(options.mode);
      await this.notification.notify(
        options.mode === 'daily' ? 'cairn 실패' : `cairn ${label} 실패`,
        `${options.date} ${label} 생성 실패 — ${error.message.slice(0, 120)}`,
      );
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
    const published =
      options.force || options.skipNotion
        ? new Set<string>()
        : await this.notionPublisher.findPublishedDates(rangeStart, rangeEnd);
    // journal 쓰기 후 노션 발행만 실패한 날짜 — 아래 hasDaily 필터에 영구 제외되지 않도록
    // 재요약 없이 journal 내용으로 재발행
    let republishedCount = 0;
    if (!options.force && !options.skipNotion) {
      republishedCount = await this.republishFromJournal(targetDates, published, options);
    }

    // 노션 발행 목록 + journal 파일 둘 다 없는 날짜만 backfill — 노션 미연동에서도 중복 재요약 방지
    const missingDates = options.force
      ? targetDates
      : targetDates.filter((d) => !published.has(d) && !this.journalWriter.hasDaily(d));

    if (missingDates.length === 0) {
      this.logger.info(
        { rangeStart, rangeEnd, checked: targetDates.length },
        'daily: all dates in backfill window already published — nothing to do',
      );
      // 이벤트 없이 끝나면 데스크톱이 '발행 완료'로 오보함 — 재발행이 없었을 때만 skipped 로 보고
      if (republishedCount === 0) {
        emitLocalSkip();
      }
      return;
    }

    // 기여 캘린더로 빈 날짜를 거르지 않음 — 기존 PR 브랜치에 푸시만 한 날을 0으로 세서 일지가 누락됨
    const backfillDates = missingDates;

    if (backfillDates.length === 1) {
      await this.runDailyForDate(backfillDates[0]!, options, { silent: false });
      return;
    }

    this.logger.info(
      {
        missingDates: backfillDates,
        alreadyPublishedCount: targetDates.length - backfillDates.length,
      },
      'daily: backfill — multiple missing dates detected',
    );

    const completedDates: string[] = [];
    const failedDates: string[] = [];
    const backfillTotal = backfillDates.length;
    // 데스크톱 배치 진행 UI 가 시작 즉시 총개수·날짜 목록으로 행을 그리는 용도
    this.logger.info(
      { total: backfillTotal, dates: backfillDates.join(',') },
      'daily: backfill batch start',
    );
    emitParentEvent({ type: 'backfill-start', total: backfillTotal, dates: [...backfillDates] });
    const results = await withConcurrency<
      string,
      { date: string; kind: PublishWorklogResult['kind'] | 'no-activity' | 'failed' }
    >(backfillDates, BACKFILL_CONCURRENCY, async (date) => {
      // 날짜별 시작 — 요약 중인 칸 펄스 표시용
      this.logger.info({ date }, 'daily: backfill date start');
      emitParentEvent({ type: 'backfill-date-start', date });
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
        failedDates.push(date);
      }
      completedDates.push(date);
      // doneDates: 완료 순서가 날짜 순서와 달라 UI 가 멤버십으로 판정하도록 누적
      // failedDates: done 에도 포함되는 실패 날짜를 UI 가 구분 표시하도록 별도 누적
      this.logger.info(
        {
          date,
          done: completedDates.length,
          total: backfillTotal,
          doneDates: completedDates.join(','),
          failedDates: failedDates.join(','),
        },
        'daily: backfill progress',
      );
      emitParentEvent({
        type: 'backfill-progress',
        done: completedDates.length,
        total: backfillTotal,
        doneDates: [...completedDates],
        failedDates: [...failedDates],
      });
      return result;
    });

    await this.notifyBackfillBatch(backfillDates, results);

    // 전 날짜 실패인데 exit 0 이면 데스크톱이 '발행 완료'로 오보함 — 런 실패로 전파
    if (failedDates.length === backfillTotal) {
      throw CairnError.from(
        new Error(
          `백필 ${backfillTotal}건 전부 실패 — 마지막 실패: ${failedDates[failedDates.length - 1]}`,
        ),
        'config',
      );
    }
  }

  // 노션 발행만 실패했던 날짜(journal 있음 + published 없음)를 재요약 없이 복구
  // publish 는 페이지가 실제로 있으면 skipped 를 돌려줘 findPublishedDates 일시 오류에도 안전
  private async republishFromJournal(
    targetDates: readonly string[],
    published: ReadonlySet<string>,
    options: RunOptions,
  ): Promise<number> {
    const candidates = targetDates.filter(
      (d) => !published.has(d) && this.journalWriter.hasDaily(d),
    );
    if (candidates.length === 0) return 0;

    const republished: string[] = [];
    for (const date of candidates) {
      const summary = this.journalSource.readDailySummary(date);
      if (!summary) {
        // 사용자 편집으로 파싱 불가한 journal — 조용히 넘기면 영영 미발행이라 경고, 파일은 보존
        this.logger.warn(
          { date },
          'daily: journal unparseable — republish skipped (--force 로 재생성 가능)',
        );
        continue;
      }
      try {
        const result = await this.notionPublisher.publish({
          date,
          force: false,
          github: null,
          localGit: null,
          summary,
          lang: options.lang,
        });
        // 노션 미연동이면 나머지 날짜도 재발행 대상 아님
        if (result.kind === 'no-target') return republished.length;
        if (result.kind === 'created' || result.kind === 'recreated') {
          republished.push(date);
          this.logger.info({ date, publishResult: result }, 'daily: republished from journal');
          // 이벤트 없이 넘어가면 뒤의 '전체 기발행' 분기가 skipped 로 오보함
          emitPublishResult(result);
        }
      } catch (err) {
        // Notion 장애 지속 등은 다음 예약 실행에서 같은 경로로 재시도되므로 런 계속
        this.logger.warn(
          { date, error: CairnError.from(err, 'notion') },
          'daily: journal republish failed — will retry next run',
        );
      }
    }
    if (republished.length > 0) {
      const label =
        republished.length === 1
          ? republished[0]!
          : `${republished[0]} 외 ${republished.length - 1}건`;
      await this.notification.notify('cairn 일지', `미발행 일지 재발행 — ${label}`);
    }
    return republished.length;
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
      emitParentEvent({ type: 'no-activity', date });
      return 'no-activity';
    }

    if (!options.dryRun && !options.force && opts.precheck !== false) {
      const pre = options.skipNotion
        ? ({ kind: 'no-target' } as const)
        : await this.notionPublisher.precheckDaily(date);
      // precheck 에러여도 일지가 있으면 재요약 없이 skip
      if (pre?.kind === 'precheck-error') {
        if (this.journalWriter.hasDaily(date)) {
          this.logger.info(
            { date, publishResult: { kind: 'skipped', reason: 'already-published' } },
            'daily: notion precheck failed but journal exists — skip collect/summarize',
          );
          emitLocalSkip();
          if (!opts.silent) {
            await this.notification.notify(
              'cairn 일지',
              `${date} skip — 노션 확인 실패, 로컬 일지 있음 (--force 로 재생성)`,
            );
          }
          return 'skipped';
        }
      } else if (pre && pre.kind !== 'no-target') {
        // no-target(노션 미연동)은 단락 안 함 — journal 이 1차 기록이라 런은 계속
        this.logger.info(
          { date, publishResult: pre },
          'daily: precheck short-circuit — skip collect/summarize',
        );
        emitPublishResult(pre);
        if (!opts.silent) {
          await this.notify(date, pre, { prCount: 0, commitCount: 0 });
        }
        return pre.kind;
      }
      // 노션 미연동이어도 journal 에 이미 있는 날짜는 재요약 안 함 — 요약 비용 보호
      if (pre?.kind === 'no-target' && this.journalWriter.hasDaily(date)) {
        // 데스크톱이 precheck 단락과 같은 publishResult 모양으로 skip 을 판정하도록 구조화 필드 포함
        this.logger.info(
          { date, publishResult: { kind: 'skipped', reason: 'already-published' } },
          'daily: journal file exists — skip collect/summarize',
        );
        emitLocalSkip();
        if (!opts.silent) {
          await this.notification.notify(
            'cairn 일지',
            `${date} skip — 로컬 일지 있음 (--force 로 재생성)`,
          );
        }
        return 'skipped';
      }
    }

    opts.onStep?.('collect');
    emitParentEvent({ type: 'date-step', date, step: 'collect' });
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
    const sourceErrors = collectSourceErrors(githubActivity, localGitActivity);

    if (prCount + commitCount === 0) {
      // 수집 에러로 인한 0건은 '활동 없음'으로 위장하지 않음 — 토큰 만료 등이 무음으로 넘어가지 않게 throw
      if (sourceErrors.length > 0) {
        const first = sourceErrors[0]!;
        this.logger.warn(
          {
            date,
            sourceErrors: sourceErrors.map((e) => ({
              source: e.source,
              label: e.label,
              code: e.error.code,
            })),
          },
          'daily: zero activity with collect errors — failing run',
        );
        throw new CairnError(
          first.error.source,
          first.error.code,
          `수집 실패 (${sourceErrors.map((e) => e.label).join(', ')}) — ${first.error.message}`,
          first.error.status,
        );
      }
      this.logger.info({ date }, 'daily: no activity collected — skipping summarizer + publisher');
      emitParentEvent({ type: 'no-activity', date });
      if (!opts.silent) {
        await this.notification.notify('cairn 일지', `${date} 활동 없음 — 일지 생략`);
      }
      return 'no-activity';
    }

    // 부분 수집 실패(일부 계정/레포)는 총량>0 이라 정상 발행처럼 보임 — 경고 이벤트로 표면화
    if (sourceErrors.length > 0) {
      const labels = sourceErrors.map((e) =>
        e.source === 'local-git' ? (e.label.split('/').pop() ?? e.label) : e.label,
      );
      this.logger.warn(
        { date, labels },
        'daily: partial collect failure — journal may be missing activity',
      );
      emitParentEvent({ type: 'collect-partial', labels });
    }

    // 로컬+GitHub PR dedup 합계를 요약 전에 기록 — 발행 진행 UI 칩이 로컬 전용 수치 대신 실제 합계 표시
    this.logger.info({ date, prCount, commitCountTotal: commitCount }, 'daily: day totals');

    opts.onStep?.('summarize');
    emitParentEvent({ type: 'date-step', date, step: 'summarize' });
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

    // 요약 실패(세션 만료·쿼터 소진·중단)면 발행 안 함 — 빈 fallback 페이지가 성공처럼 남지 않게 발행 전에 throw
    if (!summary) {
      this.logger.warn({ date }, 'daily: summary generation failed — aborting publish');
      emitParentEvent({ type: 'summary-failed', date });
      throw CairnError.from(
        new Error('요약 생성 실패 — Claude 세션/쿼터를 확인한 뒤 다시 발행하세요'),
        'summarizer',
      );
    }

    opts.onStep?.('publish');
    emitParentEvent({ type: 'date-step', date, step: 'publish' });
    const publishStart = Date.now();

    // 커밋 시각 24칸 히스토그램(머신 로컬 TZ, shaKey 로 SHA 중복 제거) — journal frontmatter 와 로컬 통계가 공유
    const seen = new Set<string>();
    const stamps: string[] = [];
    const commits = [
      ...(localGitActivity?.repos ?? []).flatMap((r) => r.commits),
      ...(githubActivity?.prs ?? []).flatMap((pr) => pr.commitsOnDate),
    ];
    for (const c of commits) {
      const key = shaKey(c.shortSha);
      if (seen.has(key)) continue;
      seen.add(key);
      stamps.push(c.authoredAt);
    }
    const hours = hourHistogram(stamps);

    // 1차 기록은 로컬 journal, 노션은 연동 싱크 — journal 실패가 연동 발행을 막지 않음
    const journalInput = {
      date,
      lang: options.lang,
      summary,
      prCount,
      commitCount,
      hours,
    };
    let journalWritten = false;
    try {
      const written = this.journalWriter.writeDaily(journalInput);
      journalWritten = true;
      emitParentEvent({ type: 'journal-written', fileName: written.fileName });
    } catch (err) {
      this.logger.warn(
        { date, error: CairnError.from(err, 'config') },
        'daily: journal write failed',
      );
      emitParentEvent({ type: 'journal-write-failed' });
    }

    // skipNotion 은 no-target 모양 — 데스크톱 파싱 계약 유지
    const result: PublishWorklogResult = options.skipNotion
      ? { kind: 'no-target' }
      : await this.notionPublisher.publish({
          date,
          force: options.force,
          github: githubActivity,
          localGit: localGitActivity,
          summary,
          lang: options.lang,
        });
    const publishMs = Date.now() - publishStart;
    emitPublishResult(result);
    emitParentEvent({
      type: 'day-done',
      date,
      pr: prCount,
      commit: commitCount,
      pageId: 'pageId' in result ? result.pageId : null,
    });

    if (journalWritten && (result.kind === 'created' || result.kind === 'recreated')) {
      try {
        this.journalWriter.writeDaily({ ...journalInput, notionPageId: result.pageId });
      } catch {
        // frontmatter 의 notion 참조 갱신 실패는 치명적이지 않음 — 본문은 이미 기록됨
      }
    }

    // 통계의 진실 소스는 노션이 아닌 로컬, pr·commit 은 위 distinct 총량과 동일
    if (journalWritten || result.kind === 'created' || result.kind === 'recreated') {
      this.stats.record('daily', date, {
        pr: prCount,
        commit: commitCount,
        hours,
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
      await this.notify(date, result, { prCount, commitCount, journalWritten });
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
      journalWritten?: boolean;
    },
  ): Promise<void> {
    const counts_label = `gh:${counts.prCount} / git:${counts.commitCount}`;

    if (result.kind === 'created') {
      await this.notification.notify('cairn 일지', `${date} 발행 (${counts_label})`);
    } else if (result.kind === 'recreated') {
      await this.notification.notify('cairn 일지', `${date} 재발행 (${counts_label})`);
    } else if (result.kind === 'skipped') {
      await this.notification.notify(
        'cairn 일지',
        `${date} skip — ${result.reason} (--force 로 재생성)`,
      );
    } else if (result.kind === 'no-target') {
      if (counts.journalWritten) {
        await this.notification.notify('cairn 일지', `${date} 로컬 기록 완료 (${counts_label})`);
      } else {
        await this.notification.notify(
          'cairn 설정 필요',
          `${date} 발행 대상 없음 — worklog.config.json 의 worklog.pageId 또는 token 확인`,
        );
      }
    }
  }

  private async runRollup(
    period: 'weekly' | 'monthly' | 'yearly',
    options: RunOptions,
  ): Promise<void> {
    if (!options.dryRun && !options.force) {
      const pre = options.skipNotion
        ? ({ kind: 'no-target' } as const)
        : await this.rollupPublisher.precheck(period, options.date);
      // no-target(노션 미연동)은 단락 안 함 — journal 이 1차 기록
      if (pre && pre.kind !== 'no-target') {
        const { start, end } = periodRange(period, options.date);
        this.logger.info(
          { period, rangeStart: start, rangeEnd: end, publishResult: pre },
          'rollup: precheck short-circuit — skip collect/summarize',
        );
        emitPublishResult(pre);
        await this.notifyRollup(period, start, end, pre);
        return;
      }
      // 노션 미연동이어도 journal 에 이미 있는 기간은 재요약 안 함 — 요약 비용 보호
      if (pre?.kind === 'no-target') {
        const { start, end } = periodRange(period, options.date);
        if (this.journalWriter.hasRollup(period, start)) {
          this.logger.info(
            {
              period,
              rangeStart: start,
              rangeEnd: end,
              publishResult: { kind: 'skipped', reason: 'already-published' },
            },
            'rollup: journal file exists — skip collect/summarize',
          );
          emitLocalSkip();
          await this.notification.notify(
            `cairn ${rollupKor(period)}`,
            `${start} ~ ${end} skip — 로컬 정리 있음 (--force 로 재생성)`,
          );
          return;
        }
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
      // 수집 실패의 0건은 '일지 없음'이 아님 — 성공 종료하면 데스크톱이 rollup anchor 를 기록해 catch-up 에서 영구 제외됨
      if (activity.error) {
        this.logger.warn(
          { period, error: activity.error },
          'rollup: collect failed — failing run instead of "no dailies" skip',
        );
        throw activity.error;
      }
      this.logger.info(
        { period, rangeStart: activity.rangeStart, rangeEnd: activity.rangeEnd },
        'rollup: no source pages in range — skipping summarizer + publisher',
      );
      const missing = period === 'yearly' ? '월간 정리 없음' : '일지 없음';
      await this.notification.notify(
        titleKor,
        `${activity.rangeStart} ~ ${activity.rangeEnd} ${missing} — ${periodKor} 생략`,
      );
      // 이벤트 없이 끝나면 데스크톱이 '발행 완료'로 오보함
      emitParentEvent({ type: 'no-activity', date: activity.rangeStart });
      return;
    }

    const summary = await this.rollupSummarizer.summarize({ activity }, options.lang);

    if (!summary) {
      this.logger.warn(
        { period: activity.period, rangeStart: activity.rangeStart },
        'rollup: summary generation failed — aborting publish',
      );
      emitParentEvent({ type: 'summary-failed', date: activity.rangeStart });
      throw CairnError.from(
        new Error('롤업 요약 생성 실패 — Claude 세션/쿼터를 확인한 뒤 다시 발행하세요'),
        'summarizer',
      );
    }

    // 롤업도 로컬 journal 이 1차 기록
    const rollupJournalInput = {
      period,
      rangeStart: activity.rangeStart,
      rangeEnd: activity.rangeEnd,
      lang: options.lang,
      summary,
      // yearly 는 월간 파일([[YYYY-MM]])로 링크
      dailyDates: activity.dailies.map((d) => (period === 'yearly' ? d.date.slice(0, 7) : d.date)),
      prCount: activity.metrics.prCount,
      commitCount: activity.metrics.commitCount,
    };
    let journalWritten = false;
    try {
      const written = this.journalWriter.writeRollup(rollupJournalInput);
      journalWritten = true;
      emitParentEvent({ type: 'journal-written', fileName: written.fileName });
    } catch (err) {
      this.logger.warn(
        { period, rangeStart: activity.rangeStart, error: CairnError.from(err, 'config') },
        'rollup: journal write failed',
      );
      emitParentEvent({ type: 'journal-write-failed' });
    }

    // skipNotion 은 no-target 모양 — 데스크톱 파싱 계약 유지
    const result: PublishRollupResult = options.skipNotion
      ? { kind: 'no-target' }
      : await this.rollupPublisher.publish({
          activity,
          force: options.force,
          summary,
          lang: options.lang,
        });
    emitPublishResult(result);

    if (journalWritten && (result.kind === 'created' || result.kind === 'recreated')) {
      try {
        this.journalWriter.writeRollup({ ...rollupJournalInput, notionPageId: result.pageId });
      } catch {
        // frontmatter 의 notion 참조 갱신 실패는 치명적이지 않음 — 본문은 이미 기록됨
      }
    }

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

    await this.notifyRollup(period, activity.rangeStart, activity.rangeEnd, result);
  }

  private async notifyRollup(
    period: 'weekly' | 'monthly' | 'yearly',
    rangeStart: string,
    rangeEnd: string,
    result: PublishRollupResult,
  ): Promise<void> {
    const titleKor = `cairn ${rollupKor(period)}`;
    const range = `${rangeStart} ~ ${rangeEnd}`;

    if (result.kind === 'created') {
      await this.notification.notify(titleKor, `${range} 발행`);
    } else if (result.kind === 'recreated') {
      await this.notification.notify(titleKor, `${range} 재발행`);
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

function rollupKor(period: 'weekly' | 'monthly' | 'yearly'): string {
  if (period === 'weekly') return '주간 정리';
  if (period === 'monthly') return '월간 정리';
  return '연간 정리';
}

function generatePastDates(today: string, days: number): string[] {
  const [y, m, d] = today.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`invalid today: ${today}`);
  }
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDaysIso(today, -i));
  return out;
}

function emitPublishResult(r: PublishWorklogResult | PublishRollupResult): void {
  emitParentEvent({
    type: 'publish-result',
    kind: r.kind,
    pageId: 'pageId' in r ? r.pageId : null,
    url: 'url' in r ? r.url : null,
  });
}

// 로컬 일지만 있어 노션 페이지를 모르는 skip
function emitLocalSkip(): void {
  emitParentEvent({ type: 'publish-result', kind: 'skipped', pageId: null, url: null });
}
