import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRunning, runCore, type CoreMode, type CoreRunOptions } from './core-runner';
import { readConfig, tailLatestLog } from './files';
import { listRecentPages } from './notion-client';
import { setupTray } from './tray';

const __dirname = dirname(fileURLToPath(import.meta.url));

let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 20 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: app.isPackaged ? ['--cairn-packaged'] : [],
    },
  });

  win.on('ready-to-show', () => win.show());

  win.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    win.hide();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

void app.whenReady().then(() => {
  ipcMain.handle('cairn:run', (e, mode: CoreMode, options?: CoreRunOptions) =>
    runCore(mode, options ?? {}, e.sender),
  );
  ipcMain.handle('cairn:running', () => isRunning());
  ipcMain.handle('cairn:open-external', (_e, url: string) => shell.openExternal(url));
  ipcMain.handle('cairn:config:read', () => readConfig());
  ipcMain.handle('cairn:logs:tail', () => tailLatestLog());
  ipcMain.handle('cairn:recent:list', () => listRecentPages());

  const win = createWindow();
  setupTray(win);

  app.on('activate', () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {});
