import { app, BrowserWindow, Notification } from 'electron';
import type { CoreMode, CoreResult } from './core-runner';
import { mt } from './i18n';
import { readSettings } from './settings';

const modeLabel = (mode: CoreMode): string => mt(`mode.${mode}`);

// 참조를 안 잡으면 GC 가 Notification 을 수거해 click 리스너가 죽는다(Electron) — click/close 시 해제
const activeNotifications = new Set<Notification>();

function focusModeInApp(mode: CoreMode): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send('cairn:focus-mode', mode);
}

function notify(title: string, body: string, mode: CoreMode): void {
  // 앱이 포커스 상태면 macOS 가 배너를 억제하므로, dock 바운스로 완료를 확실히 알린다
  app.dock?.bounce('informational');
  if (!Notification.isSupported()) return;
  const noti = new Notification({ title, body });
  activeNotifications.add(noti);
  noti.on('click', () => {
    activeNotifications.delete(noti);
    focusModeInApp(mode);
  });
  noti.on('close', () => activeNotifications.delete(noti));
  noti.show();
}

export function sendResultNotification(mode: CoreMode, result: CoreResult): void {
  if (!readSettings().notifications) return;
  const label = modeLabel(mode);

  if (!result.ok) {
    notify(`${label} ${mt('notify.failSuffix')}`, `exit ${result.exitCode ?? 'unknown'}`, mode);
    return;
  }
  if (result.summaryFailed) {
    notify(`${label} ${mt('notify.summaryFailedSuffix')}`, mt('notify.summaryFailedBody'), mode);
    return;
  }
  if (result.publishKind === 'no-target') {
    // 노션 미연동이어도 로컬 일지가 저장됐으면 성공 — "발행 대상 없음" 오보 방지
    if (result.journalFile) {
      notify(`${label} ${mt('notify.localDoneSuffix')}`, mt('notify.localDoneBody'), mode);
    } else {
      notify(label, mt('notify.noTarget'), mode);
    }
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

function notifyWithAction(
  title: string,
  body: string,
  onClick: () => void,
  onClose?: () => void,
): boolean {
  app.dock?.bounce('informational');
  if (!Notification.isSupported()) return false;
  const noti = new Notification({ title, body });
  activeNotifications.add(noti);
  noti.on('click', () => {
    activeNotifications.delete(noti);
    onClick();
  });
  noti.on('close', () => {
    activeNotifications.delete(noti);
    onClose?.();
  });
  noti.show();
  return true;
}

// notifications 토글과 무관하게 항상 표시 — 억제하면 confirmBeforeRun 사용자의 발행이 영영 안 됨
let confirmActive = false;
let confirmResetTimer: NodeJS.Timeout | null = null;
// 알림이 click/close 이벤트 없이 사라지는 경우(알림센터 이동·표시 억제)가 실제로 있어,
// 리셋 없인 confirmActive 가 영구 true — 이후 모든 스케줄 체크가 '배너 표시 중'으로
// 오판해 자동 발행이 앱 재시작 전까지 전면 중단되던 문제. 타임아웃 후 재프롬프트 허용
const CONFIRM_RESET_MS = 10 * 60_000;

function clearConfirm(): void {
  confirmActive = false;
  if (confirmResetTimer) {
    clearTimeout(confirmResetTimer);
    confirmResetTimer = null;
  }
}

export function notifyAutoConfirm(modes: CoreMode[], onConfirm: () => void): boolean {
  const primary = modes[0];
  if (!primary) return false;
  // resume 직후 타이머·resume 핸들러가 연달아 불러도 confirm 배너는 한 장만
  if (confirmActive) return true;
  const label = modes.map((m) => modeLabel(m)).join(', ');
  const shown = notifyWithAction(
    mt('notify.autoConfirmTitle'),
    mt('notify.autoConfirm', { mode: label }),
    () => {
      clearConfirm();
      focusModeInApp(primary);
      onConfirm();
    },
    () => {
      clearConfirm();
    },
  );
  confirmActive = shown;
  if (shown) {
    confirmResetTimer = setTimeout(() => {
      confirmActive = false;
      confirmResetTimer = null;
    }, CONFIRM_RESET_MS);
  }
  return shown;
}

// 명시적 요청이므로 설정 토글과 무관하게 항상 표시 시도 (권한 프롬프트 유도 포함)
// 알려진 제약: dev 에선 번들 ID 없는 Electron 헬퍼라 macOS 가 알림을 억제해 안 뜸 —
// 패키지(.app + Info.plist bundle id)에선 정상. 버그 아님, 패키지 빌드로 확인할 것
export function sendTestNotification(): { supported: boolean } {
  if (!Notification.isSupported()) return { supported: false };
  new Notification({ title: mt('notify.testTitle'), body: mt('notify.testBody') }).show();
  return { supported: true };
}
