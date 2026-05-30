import { BrowserWindow, Notification } from 'electron';
import type { CoreMode, CoreResult } from './core-runner';

const MODE_LABEL: Record<CoreMode, string> = {
  daily: '오늘 일지',
  weekly: '이번 주 정리',
  monthly: '이번 달 정리',
};

function focusModeInApp(mode: CoreMode): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send('cairn:focus-mode', mode);
}

function notify(title: string, body: string, mode: CoreMode): void {
  if (!Notification.isSupported()) return;
  const noti = new Notification({ title, body });
  noti.on('click', () => focusModeInApp(mode));
  noti.show();
}

export function sendResultNotification(mode: CoreMode, result: CoreResult): void {
  const label = MODE_LABEL[mode];

  if (!result.ok) {
    notify(`${label} 실패`, `exit ${result.exitCode ?? 'unknown'}`, mode);
    return;
  }
  if (result.noActivity) {
    notify(label, '활동 없음 — 발행 안 함', mode);
    return;
  }
  if (result.publishKind === 'skipped') {
    notify(label, '이미 발행됨 — 클릭하면 앱에서 확인', mode);
    return;
  }
  notify(`${label} 발행 완료`, '클릭하면 앱에서 결과 확인', mode);
}
