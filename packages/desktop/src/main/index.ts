import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSupabaseConfig } from './supabase';
import { initAutoPublish, reconfigureAutoPublish } from './auto-publish';
import { pickExportFolder, saveMarkdown, savePdf } from './export';
import { sendTestNotification } from './notifier';
import {
  busyState,
  cancelRun,
  isRunning,
  probeClaude,
  runCore,
  runSnapshot,
  type CoreMode,
  type CoreRunOptions,
} from './core-runner';
import { readConfig, tailLatestLog } from './files';
import { fetchPageContent, listRecentPages } from './notion-client';
import {
  finishOnboarding,
  githubTokenFromGhCli,
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
import { reconfigureTray, setupTray } from './tray';
import { initUpdater } from './updater';

declare const __WORKSPACE_VERSION__: string;

const __dirname = dirname(fileURLToPath(import.meta.url));

let allowQuit = false;
let pendingDeepLink: string | null = null;

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('cairn', process.execPath, [resolve(process.argv[1]!)]);
} else {
  app.setAsDefaultProtocolClient('cairn');
}

function dispatchDeepLink(url: string): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.webContents.isLoading()) {
    win.webContents.send('cairn:deep-link', url);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } else {
    pendingDeepLink = url;
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

// 미서명 앱이라 safeStorage 가 OS 키체인을 건드리면 암호 프롬프트가 매번 뜬다 → mock keychain 사용.
// cairn 은 토큰을 .env 평문 저장이라 부작용 없음. password-store=basic 은 Linux 전용.
app.commandLine.appendSwitch('use-mock-keychain');
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', 'basic');
}

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}
app.on('second-instance', (_e, argv) => {
  const url = argv.find((a) => a.startsWith('cairn://'));
  if (url) dispatchDeepLink(url);
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

const initialDeepLink = process.argv.find((a) => a.startsWith('cairn://'));
if (initialDeepLink) pendingDeepLink = initialDeepLink;

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

  win.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      win.webContents.send('cairn:deep-link', pendingDeepLink);
      pendingDeepLink = null;
    }
  });

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
      // dev 편의 기능
    }
  }

  ipcMain.handle('cairn:run', (_e, mode: CoreMode, options?: CoreRunOptions) =>
    runCore(mode, options ?? {}),
  );
  ipcMain.handle('cairn:running', () => isRunning());
  ipcMain.handle('cairn:run-cancel', () => cancelRun());
  ipcMain.handle('cairn:busy-state', () => busyState());
  ipcMain.handle('cairn:run-snapshot', () => runSnapshot());
  ipcMain.handle('cairn:export:save-markdown', (_e, defaultName: string, content: string) =>
    saveMarkdown(defaultName, content),
  );
  ipcMain.handle('cairn:export:pick-folder', () => pickExportFolder());
  ipcMain.handle('cairn:notify:test', () => sendTestNotification());
  ipcMain.handle('cairn:export:save-pdf', (_e, defaultName: string, html: string) =>
    savePdf(defaultName, html),
  );
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
      supabase: readSupabaseConfig(),
    };
  });
  ipcMain.handle('cairn:settings:set', (_e, patch: Partial<Settings>) => {
    const next = writeSettings(patch);
    if (patch.autoPublish) reconfigureAutoPublish();
    if (patch.language) reconfigureTray();
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
  ipcMain.handle('cairn:onboarding:github-from-gh', () => githubTokenFromGhCli());
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
