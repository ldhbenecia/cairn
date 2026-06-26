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

function msUntilLocalTime(time: string): number {
  const parts = time.split(':');
  const h = Number.parseInt(parts[0] ?? '', 10);
  const m = Number.parseInt(parts[1] ?? '', 10);
  const now = new Date();
  const next = new Date(now);
  next.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

// 지난주 일요일(이번 주 월요일의 전날) — weekly 롤업 anchor. 한 주 내내 같은 값이라 catch-up 안정적.
function lastCompletedWeekAnchor(now: Date): string {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7; // Mon→0 … Sun→6
  d.setDate(d.getDate() - sinceMonday - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 지난달 마지막 날 — monthly 롤업 anchor. 한 달 내내 같은 값.
function lastCompletedMonthAnchor(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const anyAutoOn = (cfg: AutoPublish): boolean => cfg.daily || cfg.weekly || cfg.monthly;

export function isScheduledTimeReached(now: Date, time: string): boolean {
  const [hStr, mStr] = time.split(':');
  const h = Number.parseInt(hStr ?? '', 10);
  const m = Number.parseInt(mStr ?? '', 10);
  const sh = Number.isFinite(h) ? h : 19;
  const sm = Number.isFinite(m) ? m : 0;
  return now.getHours() * 60 + now.getMinutes() >= sh * 60 + sm;
}

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
  if (cfg.daily) runs.push({ mode: 'daily', options: { backfillDays: cfg.backfillDays } });
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

async function runAutoPublish(trigger: 'startup' | 'scheduled'): Promise<void> {
  const cfg = readSettings().autoPublish;

  // 시작 시 백필은 예약 시각이 이미 지난 경우에만 — 아니면 앱을 켜는 순간 오늘치가 발행돼 버린다
  if (trigger === 'startup' && !isScheduledTimeReached(new Date(), cfg.time)) return;

  const runs = dueRuns(cfg, readAutoPublishState());
  if (runs.length === 0) return;

  if (cfg.confirmBeforeRun) {
    notifyAutoConfirm(runs[0]!.mode);
    return;
  }

  if (isRunning()) return;

  for (const { mode, options, rollupField, anchor } of runs) {
    notifyAutoStart(mode);
    try {
      const result = await runCore(mode, options);
      // runCore 는 실패 시 throw 가 아니라 ok:false 를 반환 → 성공일 때만 anchor 기록(실패면 다음 실행에서 재시도)
      if (result.ok && rollupField && anchor) {
        writeAutoPublishState({ ...readAutoPublishState(), [rollupField]: anchor });
      }
    } catch {
      // 결과 알림은 runCore 내부 처리
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
    void runAutoPublish('scheduled');
    scheduleDaily();
  }, msUntilLocalTime(cfg.time));
}

export function initAutoPublish(): void {
  void runAutoPublish('startup');
  scheduleDaily();
}

export function reconfigureAutoPublish(): void {
  scheduleDaily();
}
