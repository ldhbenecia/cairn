import { app, Notification, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { mt } from './i18n';
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
      title: mt('updater.title'),
      body: mt('updater.body', { version: info.version }),
    });
    noti.on('click', () => void shell.openExternal(RELEASES_URL));
    noti.show();
  });

  autoUpdater.on('error', () => {});

  void autoUpdater.checkForUpdates();
  setInterval(() => void autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}
