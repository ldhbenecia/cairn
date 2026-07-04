import { powerMonitor } from 'electron';
import {
  isScheduledTimeReached,
  lastCompletedMonthAnchor,
  lastCompletedWeekAnchor,
  localTodayIso,
  msUntilLocalTime,
} from './auto-publish-schedule';
import { isRunning, runCore, type CoreMode, type CoreRunOptions } from './core-runner';
import { notifyAutoConfirm, notifyAutoStart } from './notifier';
import { readSettings, type AutoPublish } from './settings';
import {
  readAutoPublishState,
  writeAutoPublishState,
  type AutoPublishState,
} from './auto-publish-state';

// 발화 시각은 사용자 로컬 TZ(rules/timezone.md)

let dailyTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const RETRY_DELAY_MS = 5 * 60_000;

// 예약 시각에 다른 실행이 점유 중이면 그날 발행이 통째로 누락되던 문제 — 잠시 뒤 재시도.
// runAutoPublish 가 시각 게이트·dueRuns 를 재평가하므로 중복 발행 없음.
function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runAutoPublish();
  }, RETRY_DELAY_MS);
}

const anyAutoOn = (cfg: AutoPublish): boolean => cfg.daily || cfg.weekly || cfg.monthly;

type DueRun = {
  mode: CoreMode;
  options: CoreRunOptions;
  rollupField?: keyof AutoPublishState;
  anchor?: string;
};

// 직전 완료 기간을 anchor 로. 마지막 발행 anchor 와 다르면(=미발행) 실행 → 발화 시각에 앱이 꺼져
// 있어 놓친 주/월도 다음 실행에서 catch-up. 엔진이 중복은 skip 하므로 재시도 안전.
function dueRuns(cfg: AutoPublish, state: AutoPublishState): DueRun[] {
  const now = new Date();
  const runs: DueRun[] = [];
  if (cfg.daily) {
    const today = localTodayIso(now);
    if (state.daily !== today) {
      runs.push({
        mode: 'daily',
        options: { backfillDays: cfg.backfillDays },
        rollupField: 'daily',
        anchor: today,
      });
    }
  }
  if (cfg.weekly) {
    const anchor = lastCompletedWeekAnchor(now);
    if (state.weekly !== anchor) {
      runs.push({ mode: 'weekly', options: { date: anchor }, rollupField: 'weekly', anchor });
    }
  }
  if (cfg.monthly) {
    const anchor = lastCompletedMonthAnchor(now);
    if (state.monthly !== anchor) {
      runs.push({ mode: 'monthly', options: { date: anchor }, rollupField: 'monthly', anchor });
    }
  }
  return runs;
}

async function runAutoPublish(): Promise<void> {
  const cfg = readSettings().autoPublish;

  // 잠자기로 밀린 타이머가 깨어날 때 즉시 발화해도 예약 시각 전이면 발행 안 함
  if (!isScheduledTimeReached(new Date(), cfg.time)) return;

  const runs = dueRuns(cfg, readAutoPublishState());
  if (runs.length === 0) return;

  if (cfg.confirmBeforeRun) {
    const shown = notifyAutoConfirm(
      runs.map((r) => r.mode),
      () => void executeRuns(dueRuns(cfg, readAutoPublishState())),
    );
    if (!shown) await executeRuns(runs);
    return;
  }

  await executeRuns(runs);
}

async function executeRuns(runs: DueRun[]): Promise<void> {
  if (isRunning()) {
    console.warn(
      `[auto-publish] busy — retry in ${RETRY_DELAY_MS / 60_000}m: ${runs.map((r) => r.mode).join(', ')}`,
    );
    scheduleRetry();
    return;
  }
  for (const { mode, options, rollupField, anchor } of runs) {
    notifyAutoStart(mode);
    try {
      const result = await runCore(mode, options, 'scheduled');
      // runCore 는 실패 시 throw 가 아니라 ok:false 를 반환 → 성공일 때만 anchor 기록(실패면 다음 실행에서 재시도)
      if (result.ok && rollupField && anchor) {
        writeAutoPublishState({ ...readAutoPublishState(), [rollupField]: anchor });
      }
    } catch {
      // busy 레이스(루프 도중 수동 실행 시작) — anchor 미기록 상태라 재시도에서 다시 due
      scheduleRetry();
    }
  }
}

function scheduleDaily(): void {
  if (dailyTimer) {
    clearTimeout(dailyTimer);
    dailyTimer = null;
  }
  const cfg = readSettings().autoPublish;
  if (!anyAutoOn(cfg)) return;
  dailyTimer = setTimeout(() => {
    void runAutoPublish();
    scheduleDaily();
  }, msUntilLocalTime(cfg.time));
}

export function initAutoPublish(): void {
  void runAutoPublish();
  scheduleDaily();
  powerMonitor.on('resume', () => {
    scheduleDaily();
    void runAutoPublish();
  });
}

export function reconfigureAutoPublish(): void {
  scheduleDaily();
  // 예약 시각을 이미 지난 시각으로 바꾸면 타이머는 내일로 잡힘 — 오늘치는 즉시 catch-up
  void runAutoPublish();
}
