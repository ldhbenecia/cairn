import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { withConcurrency } from '../common/concurrency.js';
import { collectSourceErrors, computeDayTotals, shaKey } from '../common/day-totals.js';
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
import { JournalSourceService } from '../journal/journal-source.service.js';
import { JournalWriterService } from '../journal/journal-writer.service.js';
import { MemoSourceService } from '../memos/memo-source.service.js';
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
    private readonly memoSource: MemoSourceService,
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
    // skipNotion 은 노션 조회·재발행도 건너뛴다 — hasDaily(journal) 필터가 중복 재요약을 막는다
    const published =
      options.force || options.skipNotion
        ? new Set<string>()
        : await this.notionPublisher.findPublishedDates(rangeStart, rangeEnd);
    // journal 은 있는데 노션에 없는 날짜 — 과거 실행에서 journal 쓰기 성공 후 Notion 발행만
    // 실패한 케이스. 아래 hasDaily 필터가 이 날짜를 backfill 에서 영구 제외하던 문제를,
    // 재요약 없이 journal 내용 그대로 재발행하는 경로로 복구한다 (리뷰 PR-B)
    if (!options.force && !options.skipNotion) {
      await this.republishFromJournal(targetDates, published, options);
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
    const failedDates: string[] = [];
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
        failedDates.push(date);
      }
      backfillDone += 1;
      completedDates.push(date);
      // doneDates: 완료 순서가 날짜 순서와 달라도 UI 가 멤버십으로 정확히 상태 판정하도록 누적 목록 전달
      // failedDates: 실패 날짜도 done 에 포함되므로, UI 가 ✓ 대신 실패로 구분 표시할 수 있게 별도 누적
      this.logger.info(
        {
          date,
          done: backfillDone,
          total: backfillTotal,
          doneDates: completedDates.join(','),
          failedDates: failedDates.join(','),
        },
        'daily: backfill progress',
      );
      return result;
    });

    await this.notifyBackfillBatch(missingDates, results);
  }

  // Notion 발행만 실패했던 날짜(journal 있음 + published 없음)를 재요약 비용 없이 복구.
  // publish 는 페이지가 실제로 있으면 skipped 를 반환하므로(findPublishedDates 일시 오류 대비) 안전
  private async republishFromJournal(
    targetDates: readonly string[],
    published: ReadonlySet<string>,
    options: RunOptions,
  ): Promise<void> {
    const candidates = targetDates.filter(
      (d) => !published.has(d) && this.journalWriter.hasDaily(d),
    );
    if (candidates.length === 0) return;

    const republished: string[] = [];
    for (const date of candidates) {
      const summary = this.journalSource.readDailySummary(date);
      if (!summary) continue;
      try {
        const result = await this.notionPublisher.publish({
          date,
          force: false,
          github: null,
          localGit: null,
          summary,
          lang: options.lang,
        });
        // 노션 미연동이면 나머지 날짜도 동일 — 재발행 자체가 해당 없음
        if (result.kind === 'no-target') return;
        if (result.kind === 'created' || result.kind === 'recreated') {
          republished.push(date);
          this.logger.info({ date, publishResult: result }, 'daily: republished from journal');
        }
      } catch (err) {
        // Notion 장애 지속 등 — 다음 예약 실행에서 같은 경로로 재시도되므로 런은 계속
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
      // skipNotion 이면 노션 precheck 를 하지 않는다 — no-target 과 동일하게 journal 존재만 판단
      const pre = options.skipNotion
        ? ({ kind: 'no-target' } as const)
        : await this.notionPublisher.precheckDaily(date);
      // precheck API 에러(토큰 만료·노션 장애)는 '페이지 없음'과 다르다 — 로컬 일지가 이미 있으면
      // 재요약 비용을 쓰지 않고 skip, 없으면 진행 (journal-first 라 요약은 로컬에 남고 노션 실패는 표면화)
      if (pre?.kind === 'precheck-error') {
        if (this.journalWriter.hasDaily(date)) {
          this.logger.info(
            { date, publishResult: { kind: 'skipped', reason: 'already-published' } },
            'daily: notion precheck failed but journal exists — skip collect/summarize',
          );
          if (!opts.silent) {
            await this.notification.notify(
              'cairn 일지',
              `${date} skip — 노션 확인 실패, 로컬 일지 있음 (--force 로 재생성)`,
            );
          }
          return 'skipped';
        }
      } else if (pre && pre.kind !== 'no-target') {
        // no-target(노션 미연동)은 단락하지 않는다 — journal 가 1차 기록이라 런은 계속돼야 함 (ADR 0031)
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
      // 노션 미연동이어도 journal 에 이미 기록된 날짜는 재요약하지 않는다 (요약 비용 보호)
      if (pre?.kind === 'no-target' && this.journalWriter.hasDaily(date)) {
        // 데스크톱이 precheck 단락과 동일한 publishResult 모양으로 skip 을 판정하도록 구조화 필드 포함
        this.logger.info(
          { date, publishResult: { kind: 'skipped', reason: 'already-published' } },
          'daily: journal file exists — skip collect/summarize',
        );
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
    const memos = this.memoSource.forDate(date);

    if (prCount + commitCount === 0) {
      // 수집 에러로 인한 0건은 '활동 없음'으로 위장하지 않는다 — 토큰 만료 등이 매일
      // 무음으로 넘어가 일지가 통째로 누락되던 문제. throw 로 실패 알림·재시도 경로 복원
      const sourceErrors = collectSourceErrors(githubActivity, localGitActivity);
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
      // 활동 0건이어도 그날 quick capture 메모가 있으면 발행한다 — 회의·설계·학습만 한 날이
      // 캡처의 대상 시나리오인데, 스킵하면 메모가 어디에도 실리지 않고 60일 후 소멸 (ADR 0032)
      if (memos.length === 0) {
        this.logger.info(
          { date },
          'daily: no activity collected — skipping summarizer + publisher',
        );
        if (!opts.silent) {
          await this.notification.notify('cairn 일지', `${date} 활동 없음 — 일지 생략`);
        }
        return 'no-activity';
      }
      this.logger.info(
        { date, memoCount: memos.length },
        'daily: no activity but memos exist — publishing from memos',
      );
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
        memos,
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

    // 커밋 시각 24칸 히스토그램(머신 로컬 TZ, SHA 중복 제거) — journal frontmatter 와 로컬 통계가 공유.
    // dedup 키는 day-totals 와 동일한 shaKey — local %h(가변 길이)와 GitHub slice(0,7) 불일치 대응
    const seen = new Set<string>();
    const stamps: string[] = [];
    for (const repo of localGitActivity?.repos ?? []) {
      for (const c of repo.commits) {
        if (!seen.has(shaKey(c.shortSha))) {
          seen.add(shaKey(c.shortSha));
          stamps.push(c.authoredAt);
        }
      }
    }
    for (const pr of githubActivity?.prs ?? []) {
      for (const c of pr.commitsOnDate) {
        if (!seen.has(shaKey(c.shortSha))) {
          seen.add(shaKey(c.shortSha));
          stamps.push(c.authoredAt);
        }
      }
    }
    const hours = hourHistogram(stamps);

    // 일지의 1차 기록은 로컬 journal — 노션은 연동 싱크 (ADR 0031). journal 실패가 연동 발행을 막지 않는다
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
      this.journalWriter.writeDaily(journalInput);
      journalWritten = true;
    } catch (err) {
      this.logger.warn(
        { date, error: CairnError.from(err, 'config') },
        'daily: journal write failed',
      );
    }

    // 이번 발행에서 노션 제외 — 결과는 미연동과 동일한 no-target 모양 (데스크톱 파싱 계약 유지)
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

    if (journalWritten && (result.kind === 'created' || result.kind === 'recreated')) {
      try {
        this.journalWriter.writeDaily({ ...journalInput, notionPageId: result.pageId });
      } catch {
        // frontmatter 의 notion 참조 갱신 실패는 치명적이지 않다 — 본문은 이미 기록됨
      }
    }

    // 통계는 노션이 아닌 로컬에 기록(진실 소스). pr·commit 은 위 distinct 총량과 동일
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
      await this.notify(date, result, {
        prCount,
        commitCount,
        summarizerOk: !!summary,
        journalWritten,
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
      journalWritten?: boolean;
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
      if (counts.journalWritten) {
        await this.notification.notify(
          'cairn 일지',
          `${date} 로컬 기록 완료 (${counts_label})${summary_tag}`,
        );
      } else {
        await this.notification.notify(
          'cairn 설정 필요',
          `${date} 발행 대상 없음 — worklog.config.json 의 worklog.pageId 또는 token 확인`,
        );
      }
    }
  }

  private async runRollup(period: 'weekly' | 'monthly', options: RunOptions): Promise<void> {
    if (!options.dryRun && !options.force) {
      // skipNotion 이면 노션 precheck 를 하지 않는다 — no-target 과 동일하게 journal 존재만 판단
      const pre = options.skipNotion
        ? ({ kind: 'no-target' } as const)
        : await this.rollupPublisher.precheck(period, options.date);
      // no-target(노션 미연동)은 단락하지 않는다 — journal 가 1차 기록 (ADR 0031)
      if (pre && pre.kind !== 'no-target') {
        const { start, end } = periodRange(period, options.date);
        this.logger.info(
          { period, rangeStart: start, rangeEnd: end, publishResult: pre },
          'rollup: precheck short-circuit — skip collect/summarize',
        );
        await this.notifyRollup(period, start, end, pre, false);
        return;
      }
      // 노션 미연동이어도 journal 에 이미 기록된 기간은 재요약하지 않는다 (요약 비용 보호)
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
      // 수집 실패의 0건은 '일지 없음'이 아니다 — 성공 종료 시 데스크톱이 rollup anchor 를
      // 기록해 해당 기간이 catch-up 에서 영구 제외되던 문제. 실패로 전파해 재시도 복원
      if (activity.error) {
        this.logger.warn(
          { period, error: activity.error },
          'rollup: collect failed — failing run instead of "no dailies" skip',
        );
        throw activity.error;
      }
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

    // 롤업도 로컬 journal 가 1차 기록 (ADR 0031)
    const rollupJournalInput = {
      period,
      rangeStart: activity.rangeStart,
      rangeEnd: activity.rangeEnd,
      lang: options.lang,
      summary,
      dailyDates: activity.dailies.map((d) => d.date),
      prCount: activity.metrics.prCount,
      commitCount: activity.metrics.commitCount,
    };
    let journalWritten = false;
    try {
      this.journalWriter.writeRollup(rollupJournalInput);
      journalWritten = true;
    } catch (err) {
      this.logger.warn(
        { period, rangeStart: activity.rangeStart, error: CairnError.from(err, 'config') },
        'rollup: journal write failed',
      );
    }

    // 이번 발행에서 노션 제외 — 결과는 미연동과 동일한 no-target 모양 (데스크톱 파싱 계약 유지)
    const result: PublishRollupResult = options.skipNotion
      ? { kind: 'no-target' }
      : await this.rollupPublisher.publish({
          activity,
          force: options.force,
          summary,
          lang: options.lang,
        });

    if (journalWritten && (result.kind === 'created' || result.kind === 'recreated')) {
      try {
        this.journalWriter.writeRollup({ ...rollupJournalInput, notionPageId: result.pageId });
      } catch {
        // frontmatter 의 notion 참조 갱신 실패는 치명적이지 않다 — 본문은 이미 기록됨
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
