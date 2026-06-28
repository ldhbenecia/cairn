import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAutoPublish, reconfigureAutoPublish } from './auto-publish';
import { pickExportFolder, saveMarkdown, savePdf } from './export';
import { sendTestNotification } from './notifier';
import {
  busyState,
  cancelRun,
  isRunning,
  killRunning,
  probeClaude,
  runCore,
  runSnapshot,
  type CoreMode,
  type CoreRunOptions,
} from './core-runner';
import { cloudAuthState, cloudSignOut, startCloudSignIn } from './cloud-auth';
import { syncStats } from './cloud-sync';
import { readConfig, tailLatestLog } from './files';
import { fetchPageContent, listRecentPages } from './notion-client';
import {
  finishOnboarding,
  githubAccountsFromGhCli,
  listNotionDatabases,
  probeConnectionAccounts,
  probeGithub,
  probeNotion,
  searchNotionPages,
  type OnboardingPayload,
} from './onboarding';
import { fetchRepoStars } from './repo';
import { readSettings, writeSettings, type Settings } from './settings';
import { isSetupComplete } from './setup';
import {
  initTelemetry,
  shutdownTelemetry,
  trackAppLaunched,
  trackAutoPublishConfigured,
  trackOnboardingCompleted,
} from './telemetry';
import { reconfigureTray, setupTray } from './tray';
import { initUpdater } from './updater';

declare const __WORKSPACE_VERSION__: string;

const __dirname = dirname(fileURLToPath(import.meta.url));

let allowQuit = false;

// 미서명 앱이라 safeStorage 가 OS 키체인을 건드리면 암호 프롬프트가 매번 뜬다 → mock keychain 사용
// cairn 은 토큰을 .env 평문 저장이라 부작용 없음. password-store=basic 은 Linux 전용
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

function createWindow(startHidden: boolean): BrowserWindow {
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

  // 로그인 자동 실행으로 떴으면 창을 띄우지 않고 트레이에만 상주(백그라운드 시작)
  win.on('ready-to-show', () => {
    if (!startHidden) win.show();
  });

  win.on('close', (e) => {
    if (allowQuit || !app.isPackaged) return;
    e.preventDefault();
    win.hide();
  });

  // 창을 다시 열면 Dock 아이콘 복귀 — Cmd+Q 로 트레이 전용 진입 시 빠졌던 Dock 을 되살림 (macOS 전용)
  if (app.isPackaged && process.platform === 'darwin') {
    win.on('show', () => void app.dock?.show());
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// dev 바이너리(Electron.app)를 로그인 항목으로 등록하지 않도록 패키지 한정 — macOS·Windows 만 지원
// openAsHidden/args: 로그인 자동 실행 시 백그라운드(트레이)로 뜨게. setLoginItemSettings 는
// OS 권한/레지스트리 문제로 throw 할 수 있어 try-catch — 실패해도 앱 시작은 막지 않음
function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged) return;
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled, args: ['--hidden'] });
  } catch (err) {
    console.error('setLoginItemSettings failed:', err);
  }
}

// 이번 실행이 로그인 자동 실행으로 떴는지 — 초기 창 표시를 건너뛰는 판단
function launchedAtLogin(): boolean {
  if (process.platform === 'darwin') {
    try {
      return app.getLoginItemSettings().wasOpenedAtLogin;
    } catch {
      return false;
    }
  }
  if (process.platform === 'win32') return process.argv.includes('--hidden');
  return false;
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
  ipcMain.handle('cairn:open-external', (_e, url: string) => {
    try {
      const p = new URL(url).protocol;
      if (p === 'https:' || p === 'http:' || p === 'mailto:') return shell.openExternal(url);
    } catch {
      return Promise.resolve();
    }
    return Promise.resolve();
  });
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
    if (patch.autoPublish) {
      reconfigureAutoPublish();
      trackAutoPublishConfigured({
        daily: next.autoPublish.daily,
        weekly: next.autoPublish.weekly,
        monthly: next.autoPublish.monthly,
      });
    }
    if (patch.language) reconfigureTray();
    if (patch.launchAtLogin !== undefined) applyLoginItem(next.launchAtLogin);
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
  ipcMain.handle('cairn:onboarding:github-from-gh', () => githubAccountsFromGhCli());
  ipcMain.handle('cairn:onboarding:probe-claude', () => probeClaude());
  ipcMain.handle('cairn:connections:accounts', () => probeConnectionAccounts());
  ipcMain.handle('cairn:onboarding:finish', (_e, payload: OnboardingPayload) => {
    const result = finishOnboarding(payload);
    if (result.ok) trackOnboardingCompleted();
    return result;
  });
  ipcMain.handle('cairn:auth:state', () => cloudAuthState());
  ipcMain.handle('cairn:auth:sign-in', () => startCloudSignIn());
  ipcMain.handle('cairn:auth:sign-out', () => cloudSignOut());
  ipcMain.handle('cairn:sync:now', () => syncStats());
  ipcMain.handle('cairn:onboarding:pick-folder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  });

  const startHidden = app.isPackaged && launchedAtLogin();
  const win = createWindow(startHidden);
  // 백그라운드 시작이면 Dock 아이콘도 빼서 순수 트레이로 — 트레이 클릭 시 win 'show' 가 Dock 복귀
  if (startHidden && process.platform === 'darwin') app.dock?.hide();
  setupTray(win, () => {
    allowQuit = true;
    app.quit();
  });

  applyLoginItem(readSettings().launchAtLogin);
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
    // Cmd+Q 는 완전 종료가 아니라 트레이 전용(메뉴바 상주) — 이때만 Dock 아이콘 제거
    if (process.platform === 'darwin') app.dock?.hide();
    return;
  }
  killRunning(); // 진행 중 core 자식이 고아로 남지 않게 종료 전 정리
  void shutdownTelemetry();
});

app.on('window-all-closed', () => {
  if (!app.isPackaged) app.quit();
});
