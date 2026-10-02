import { app, BrowserWindow, Notification } from 'electron';
import type { CoreMode, CoreResult } from './core-runner';
import { mt } from './i18n';
import { readSettings } from './settings';
import { showWindow } from './show-window';
import { classifyRunOutcome } from '../shared/run-outcome';

const modeLabel = (mode: CoreMode): string => mt(`mode.${mode}`);

// 참조를 안 잡으면 GC 가 Notification 을 수거해 click 리스너가 죽음 — click·close 시 해제
const activeNotifications = new Set<Notification>();

function focusModeInApp(mode: CoreMode): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  showWindow(win);
  win.webContents.send('cairn:focus-mode', mode);
}

function notify(title: string, body: string, mode: CoreMode): void {
  // 앱이 포커스 상태면 macOS 가 배너를 억제 — dock 바운스로 완료 알림
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

  switch (classifyRunOutcome(result)) {
    case 'fail':
      // 흔한 실패 원인은 사용자가 행동할 수 있는 문구로 — 분류 불가여도 raw exit code 비노출
      notify(
        `${label} ${mt('notify.failSuffix')}`,
        result.failureHint ? mt(`notify.fail.${result.failureHint}`) : mt('notify.fail.unknown'),
        mode,
      );
      return;
    case 'summaryFailed':
      notify(`${label} ${mt('notify.summaryFailedSuffix')}`, mt('notify.summaryFailedBody'), mode);
      return;
    case 'localDone':
      notify(`${label} ${mt('notify.localDoneSuffix')}`, mt('notify.localDoneBody'), mode);
      return;
    case 'noTarget':
      notify(label, mt('notify.noTarget'), mode);
      return;
    case 'noActivity':
      notify(label, mt('notify.noActivity'), mode);
      return;
    case 'skipped':
      notify(label, mt('notify.skipped'), mode);
      return;
    case 'done':
      notify(`${label} ${mt('notify.doneSuffix')}`, mt('notify.doneBody'), mode);
  }
}

export function notifyAutoStart(mode: CoreMode): void {
  if (!readSettings().notifications) return;
  notify(mt('notify.autoTitle'), mt('notify.autoRunning', { mode: modeLabel(mode) }), mode);
}

export function notifyWithAction(
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

// 시작 시 토큰 건강 체크의 인증 실패(invalid) — 발행이 실패하기 전에 미리 알림
export function notifyConnectionIssue(services: string[], onClick: () => void): void {
  if (!readSettings().notifications || services.length === 0) return;
  notifyWithAction(
    mt('notify.connIssueTitle'),
    mt('notify.connIssueBody', { services: services.join(', ') }),
    onClick,
  );
}

// 클라우드 세션 만료는 sync 가 조용히 멈추는 상태라 명시 알림 — 클릭 시 재로그인
export function notifyCloudExpired(onClick: () => void): void {
  if (!readSettings().notifications) return;
  notifyWithAction(mt('notify.cloudExpiredTitle'), mt('notify.cloudExpiredBody'), onClick);
}

// notifications 토글과 무관하게 항상 표시 — 억제하면 confirmBeforeRun 사용자의 발행이 영영 안 됨
let confirmActive = false;
let confirmResetTimer: NodeJS.Timeout | null = null;
// 알림이 click·close 없이 사라지는 경우(알림센터 이동·표시 억제)가 있어 리셋이 없으면
// confirmActive 가 영구 true 로 남아 자동 발행이 전면 중단됨 — 타임아웃 후 재프롬프트 허용
const CONFIRM_RESET_MS = 10 * 60_000;

// 인앱 확인 배너에서 수락·보류해도 알림 쪽 confirmActive 를 함께 풀어야
// 다음 스케줄 체크가 '배너 표시 중'으로 오판하지 않음
export function clearConfirm(): void {
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

// 명시적 요청이라 설정 토글과 무관하게 항상 표시 시도 (권한 프롬프트 유도 포함)
// dev 는 번들 ID 없는 Electron 헬퍼라 macOS 가 억제해 안 뜸 — 패키지 빌드에서 확인
export function sendTestNotification(): { supported: boolean } {
  if (!Notification.isSupported()) return { supported: false };
  new Notification({ title: mt('notify.testTitle'), body: mt('notify.testBody') }).show();
  return { supported: true };
}
