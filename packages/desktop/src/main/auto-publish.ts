import { BrowserWindow } from 'electron';
import { isRunning, runCore } from './core-runner';
import { notifyAutoConfirm, notifyAutoStart } from './notifier';
import { readSettings } from './settings';

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

async function runAutoPublish(): Promise<void> {
  const cfg = readSettings().autoPublish;
  if (!cfg.enabled) return;

  // 크레딧 소비 전 확인 — 자동 실행 대신 알림만
  if (cfg.confirmBeforeRun) {
    notifyAutoConfirm('daily');
    return;
  }

  if (isRunning()) return;

  notifyAutoStart('daily');
  try {
    // backfill 로 밀린 날짜 채움, 이미 발행된 날짜는 엔진이 skip(중복 무해)
    await runCore('daily', { backfillDays: cfg.backfillDays }, senderWebContents());
  } catch {
    // 결과 알림은 runCore 내부 처리
  }
}

function scheduleDaily(): void {
  if (dailyTimer) {
    clearTimeout(dailyTimer);
    dailyTimer = null;
  }
  const cfg = readSettings().autoPublish;
  if (!cfg.enabled) return;
  dailyTimer = setTimeout(() => {
    void runAutoPublish();
    scheduleDaily();
  }, msUntilLocalTime(cfg.time));
}

export function initAutoPublish(): void {
  void runAutoPublish(); // 실행 시 밀린 날짜 백필
  scheduleDaily();
}

export function reconfigureAutoPublish(): void {
  scheduleDaily();
}
