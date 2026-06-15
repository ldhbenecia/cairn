import { BrowserWindow } from 'electron';
import { isRunning, runCore, type CoreMode, type CoreRunOptions } from './core-runner';
import { notifyAutoConfirm, notifyAutoStart } from './notifier';
import { readSettings, type AutoPublish } from './settings';

// 자동 발행 — 데스크톱 앱 소유(ADR 0015). 발화 시각은 사용자 로컬 TZ(rules/timezone.md).

let dailyTimer: ReturnType<typeof setTimeout> | null = null;

function senderWebContents(): Electron.WebContents | undefined {
  return BrowserWindow.getAllWindows()[0]?.webContents;
}

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

function localYesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const anyAutoOn = (cfg: AutoPublish): boolean => cfg.daily || cfg.weekly || cfg.monthly;

// 시작 시 catch-up 판단용 — 오늘 예약 시각(로컬)이 이미 지났는지.
// 지나기 전(예: 19시 예약인데 18:21 에 앱 켬)엔 발행하지 않고 타이머에 맡긴다.
export function isScheduledTimeReached(now: Date, time: string): boolean {
  const [hStr, mStr] = time.split(':');
  const h = Number.parseInt(hStr ?? '', 10);
  const m = Number.parseInt(mStr ?? '', 10);
  const sh = Number.isFinite(h) ? h : 19;
  const sm = Number.isFinite(m) ? m : 0;
  return now.getHours() * 60 + now.getMinutes() >= sh * 60 + sm;
}

// 오늘 발화해야 할 모드들 (각 토글 + 요일/날짜). 롤업은 "완료된 기간"을 정리하므로
// 어제(이미 끝난 날)를 anchor 로 — 월요일 weekly=지난주, 1일 monthly=지난달.
function dueRuns(cfg: AutoPublish): { mode: CoreMode; options: CoreRunOptions }[] {
  const now = new Date();
  const runs: { mode: CoreMode; options: CoreRunOptions }[] = [];
  if (cfg.daily) runs.push({ mode: 'daily', options: { backfillDays: cfg.backfillDays } });
  if (cfg.weekly && now.getDay() === 1) {
    runs.push({ mode: 'weekly', options: { date: localYesterdayIso() } });
  }
  if (cfg.monthly && now.getDate() === 1) {
    runs.push({ mode: 'monthly', options: { date: localYesterdayIso() } });
  }
  return runs;
}

async function runAutoPublish(trigger: 'startup' | 'scheduled'): Promise<void> {
  const cfg = readSettings().autoPublish;

  // 시작 시 백필은 "예약 시각이 이미 지난" 경우에만 — 안 그러면 앱을 켜는 순간
  // 예약 시각과 무관하게 오늘치가 발행돼 버린다. 예약 전이면 타이머가 처리.
  if (trigger === 'startup' && !isScheduledTimeReached(new Date(), cfg.time)) return;

  const runs = dueRuns(cfg);
  if (runs.length === 0) return;

  // 크레딧 소비 전 확인 — 자동 실행 대신 알림만
  if (cfg.confirmBeforeRun) {
    notifyAutoConfirm(runs[0]!.mode);
    return;
  }

  if (isRunning()) return;

  // 순차 실행. 이미 발행된 건 엔진이 skip(중복 무해)
  for (const { mode, options } of runs) {
    notifyAutoStart(mode);
    try {
      await runCore(mode, options, senderWebContents());
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
  void runAutoPublish('startup'); // 예약 시각이 이미 지났을 때만 밀린 발행 catch-up
  scheduleDaily();
}

export function reconfigureAutoPublish(): void {
  scheduleDaily();
}
