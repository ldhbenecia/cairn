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

// 미서명 앱이라 Electron 이 safeStorage(쿠키 암호화 등) 초기화 때 OS 키체인을 건드리면 암호
// 프롬프트가 매번 뜬다. password-store=basic 은 Linux 전용이라 macOS 엔 안 먹음 → use-mock-keychain
// 으로 Chromium 이 실제 키체인 대신 in-memory mock 을 쓰게 한다. cairn 은 토큰을 .env 평문 저장이고
// safeStorage·웹 쿠키를 안 써서 부작용 없음(근본 해결은 코드 서명).
app.commandLine.appendSwitch('use-mock-keychain');
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', 'basic');
}

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

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 24 },
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
