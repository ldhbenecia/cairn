import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAutoPublish, reconfigureAutoPublish } from './auto-publish';
import { isRunning, probeClaude, runCore, type CoreMode, type CoreRunOptions } from './core-runner';
import { readConfig, tailLatestLog } from './files';
import { fetchPageContent, listRecentPages } from './notion-client';
import {
  finishOnboarding,
  listNotionDatabases,
  probeGithub,
  probeNotion,
  searchNotionPages,
  type OnboardingPayload,
} from './onboarding';
import { fetchRepoStars } from './repo';
import { readSettings, writeSettings, type Settings } from './settings';
import { isSetupComplete } from './setup';
import { initTelemetry, shutdownTelemetry, trackAppLaunched } from './telemetry';
import { setupTray } from './tray';
import { initUpdater } from './updater';

declare const __WORKSPACE_VERSION__: string;

const __dirname = dirname(fileURLToPath(import.meta.url));

let allowQuit = false;

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

// 리퀴드 글래스 — 네이티브 vibrancy(NSVisualEffectView). CSS backdrop-filter 는 packaged
// 에서 합성되지 않아(styles.css 참고) OS 창 유리를 쓴다. 런타임 토글 가능 — 재시작 불필요.
const GLASS_BG = '#00000000';
const SOLID_BG = '#0a0a0a';
const isMac = process.platform === 'darwin';

function applyWindowGlass(win: BrowserWindow, on: boolean): void {
  if (!isMac) return;
  win.setVibrancy(on ? 'under-window' : null);
  win.setBackgroundColor(on ? GLASS_BG : SOLID_BG);
}

function createWindow(): BrowserWindow {
  const glass = isMac && readSettings().liquidGlass;
  const win = new BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 24 },
    backgroundColor: glass ? GLASS_BG : SOLID_BG,
    ...(glass ? { vibrancy: 'under-window' as const } : {}),
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
    if (allowQuit || !app.isPackaged) return;
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
  if (!app.isPackaged && process.platform === 'darwin') {
    try {
      app.dock?.setIcon(join(__dirname, '../../resources/icon.png'));
    } catch {
      // 무시 — dev 편의 기능
    }
  }

  ipcMain.handle('cairn:run', (e, mode: CoreMode, options?: CoreRunOptions) =>
    runCore(mode, options ?? {}, e.sender),
  );
  ipcMain.handle('cairn:running', () => isRunning());
  ipcMain.handle('cairn:open-external', (_e, url: string) => shell.openExternal(url));
  ipcMain.handle('cairn:repo:stars', () => fetchRepoStars());
  ipcMain.handle('cairn:config:read', () => readConfig());
  ipcMain.handle('cairn:logs:tail', () => tailLatestLog());
  ipcMain.handle('cairn:recent:list', () => listRecentPages());
  ipcMain.handle('cairn:notion:page-content', (_e, pageId: string, workspaceLabel: string) =>
    fetchPageContent(pageId, workspaceLabel),
  );

  ipcMain.on('cairn:bootstrap-sync', (e) => {
    e.returnValue = {
      settings: readSettings(),
      version: __WORKSPACE_VERSION__,
      setupComplete: isSetupComplete(),
    };
  });
  ipcMain.handle('cairn:settings:set', (_e, patch: Partial<Settings>) => {
    const next = writeSettings(patch);
    if (patch.autoPublish) reconfigureAutoPublish();
    if (patch.liquidGlass !== undefined) {
      const w = BrowserWindow.getAllWindows()[0];
      if (w) applyWindowGlass(w, next.liquidGlass);
    }
    return next;
  });

  ipcMain.handle('cairn:onboarding:probe-notion', (_e, token: string) => probeNotion(token));
  ipcMain.handle('cairn:onboarding:search-notion', (_e, token: string, query?: string) =>
    searchNotionPages(token, query),
  );
  ipcMain.handle('cairn:onboarding:list-databases', (_e, token: string, pageId: string) =>
    listNotionDatabases(token, pageId),
  );
  ipcMain.handle('cairn:onboarding:probe-github', (_e, token: string) => probeGithub(token));
  ipcMain.handle('cairn:onboarding:probe-claude', () => probeClaude());
  ipcMain.handle('cairn:onboarding:finish', (_e, payload: OnboardingPayload) =>
    finishOnboarding(payload),
  );
  ipcMain.handle('cairn:onboarding:pick-folder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  });

  const win = createWindow();
  setupTray(win, () => {
    allowQuit = true;
    app.quit();
  });

  // 자동 발행 — 실행 시 백필 + 매일 로컬 시각 발화 (opt-in, ADR 0015)
  initAutoPublish();
  initTelemetry();
  trackAppLaunched();
  initUpdater();

  app.on('activate', () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
});

app.on('before-quit', (e) => {
  if (!allowQuit && app.isPackaged) {
    e.preventDefault();
    BrowserWindow.getAllWindows().forEach((w) => w.hide());
    return;
  }
  void shutdownTelemetry();
});

app.on('window-all-closed', () => {
  if (!app.isPackaged) app.quit();
});
