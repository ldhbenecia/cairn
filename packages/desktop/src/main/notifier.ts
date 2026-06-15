import { BrowserWindow, Notification } from 'electron';
import type { CoreMode, CoreResult } from './core-runner';
import { mt } from './i18n';
import { readSettings } from './settings';

const modeLabel = (mode: CoreMode): string => mt(`mode.${mode}`);

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
  if (!readSettings().notifications) return;
  const label = modeLabel(mode);

  if (!result.ok) {
    notify(`${label} ${mt('notify.failSuffix')}`, `exit ${result.exitCode ?? 'unknown'}`, mode);
    return;
  }
  if (result.publishKind === 'no-target') {
    notify(label, mt('notify.noTarget'), mode);
    return;
  }
  if (result.noActivity) {
    notify(label, mt('notify.noActivity'), mode);
    return;
  }
  if (result.publishKind === 'skipped') {
    notify(label, mt('notify.skipped'), mode);
    return;
  }
  notify(`${label} ${mt('notify.doneSuffix')}`, mt('notify.doneBody'), mode);
}

export function notifyAutoStart(mode: CoreMode): void {
  if (!readSettings().notifications) return;
  notify(mt('notify.autoTitle'), mt('notify.autoRunning', { mode: modeLabel(mode) }), mode);
}

export function notifyAutoConfirm(mode: CoreMode): void {
  if (!readSettings().notifications) return;
  notify(mt('notify.autoConfirmTitle'), mt('notify.autoConfirm', { mode: modeLabel(mode) }), mode);
}

// 테스트 알림 — 사용자가 macOS 알림 권한 프롬프트를 띄우고 표시 여부를 확인하게 한다.
// 설정 토글과 무관하게 명시적 요청이므로 항상 표시 시도.
export function sendTestNotification(): { supported: boolean } {
  if (!Notification.isSupported()) return { supported: false };
  new Notification({ title: mt('notify.testTitle'), body: mt('notify.testBody') }).show();
  return { supported: true };
}
