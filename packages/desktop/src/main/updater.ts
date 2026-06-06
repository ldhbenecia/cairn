import { app, Notification, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { readSettings } from './settings';

const RELEASES_URL = 'https://github.com/ldhbenecia/cairn/releases/latest';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initUpdater(): void {
  if (!app.isPackaged) return;

  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    if (!readSettings().notifications || !Notification.isSupported()) return;
    const noti = new Notification({
      title: '새 버전이 있어요',
      body: `cairn ${info.version} — 클릭하면 다운로드 페이지로`,
    });
    noti.on('click', () => void shell.openExternal(RELEASES_URL));
    noti.show();
  });

  autoUpdater.on('error', () => {
    // 업데이트 확인 실패는 사용자에게 노출하지 않음
  });

  void autoUpdater.checkForUpdates();
  setInterval(() => void autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}
