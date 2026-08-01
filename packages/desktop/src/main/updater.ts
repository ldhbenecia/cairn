import { app, Notification, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { mt } from './i18n';
import { notifyWithAction } from './notifier';
import { readSettings } from './settings';

const RELEASES_URL = 'https://github.com/ldhbenecia/cairn/releases/latest';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initUpdater(): void {
  if (!app.isPackaged) return;

  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  let notifiedVersion: string | null = null;
  autoUpdater.on('update-available', (info) => {
    if (!readSettings().notifications || !Notification.isSupported()) return;
    // 6시간 주기 재체크마다 같은 버전을 반복 알림하지 않음
    if (info.version === notifiedVersion) return;
    notifiedVersion = info.version;
    // notifyWithAction 이 알림 참조를 보관 — 직접 new Notification 하면 GC 가 수거해
    // click 리스너가 죽어 다운로드 페이지가 안 열리던 버그
    notifyWithAction(
      mt('updater.title'),
      mt('updater.body', { version: info.version }),
      () => void shell.openExternal(RELEASES_URL),
    );
  });

  // 미서명 빌드라 자동설치 불가 — 업데이트 에러는 사용자가 대응할 수 없어 조용히 무시
  autoUpdater.on('error', () => {});

  void autoUpdater.checkForUpdates();
  setInterval(() => void autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}
