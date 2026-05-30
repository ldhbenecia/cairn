import { app, BrowserWindow } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupTray } from './tray';

const __dirname = dirname(fileURLToPath(import.meta.url));

let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 640,
    minHeight: 480,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 20 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
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
