import { app, BrowserWindow, dialog, ipcMain, powerMonitor, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAutoPublish, reconfigureAutoPublish } from './auto-publish';
import { warmClaudePath } from './claude-path';
import { exportStatus, pickExportFolder, saveMarkdown, savePdf, savePng } from './export';
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
import { readConfig } from './files';
import { type RecentCategory } from './notion-client';
import { listRecentMerged } from './journal-reader';
import { readPageBlocks, scanReportsDone, type ReportsDoneRef } from './reports-scan';
import {
  listJournalSnapshots,
  readJournalSnapshot,
  restoreJournalSnapshot,
} from './journal-snapshots';
import {
  getJournalBackupStatus,
  initJournalBackup,
  reconfigureJournalBackup,
  runJournalBackupNow,
  scheduleJournalBackup,
} from './journal-git-backup';
import {
  addNotionWorkspace,
  finishOnboarding,
  githubAccountsFromGhCli,
  listNotionDatabases,
  probeConnectionAccounts,
  probeGithub,
  probeLocalRepo,
  probeNotion,
  searchNotionPages,
  setLocalGitEnabled,
  parseNotionWorkspacePayload,
  parseOnboardingPayload,
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
    backgroundColor: '#08090a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: app.isPackaged ? ['--cairn-packaged'] : [],
    },
  });

  // 보안: 메인 윈도우는 로컬 번들만 렌더 — 원격 URL 네비게이션을 막아 preload 브릿지가
  // 외부 콘텐츠에 노출되는 벡터를 차단. 새 창 요청은 외부 브라우저로만 (https 한정)
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    if ((dev && url.startsWith(dev)) || url.startsWith('file://')) return;
    e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
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
  // 로그인 셸 PATH 캡처를 미리 비동기로 — 첫 발행/probe 의 UI 프리즈 방지
  void warmClaudePath();
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
  ipcMain.handle('cairn:export:status', () => exportStatus());
  // 폴더 경로는 renderer 인자가 아니라 설정에서 읽는다 (임의 경로 열기 방지)
  ipcMain.handle('cairn:export:reveal', () => {
    const folder = readSettings().export.folder;
    return folder ? shell.openPath(folder) : Promise.resolve('');
  });
  ipcMain.handle('cairn:notify:test', () => sendTestNotification());
  ipcMain.handle('cairn:export:save-pdf', (_e, defaultName: string, html: string) =>
    savePdf(defaultName, html),
  );
  ipcMain.handle('cairn:export:save-png', (_e, defaultName: string, dataUrl: string) =>
    savePng(defaultName, dataUrl),
  );
  ipcMain.handle('cairn:open-external', (_e, url: string) => {
    try {
      const p = new URL(url).protocol;
      // obsidian: 은 연동 탭의 journal 딥링크, x-apple.systempreferences: 는
      // '알림 설정 열기' 버튼(OS 소유 프로토콜) — 이게 빠져 버튼이 무동작이었다
      if (
        p === 'https:' ||
        p === 'http:' ||
        p === 'mailto:' ||
        p === 'obsidian:' ||
        p === 'x-apple.systempreferences:'
      )
        return shell.openExternal(url);
    } catch {
      return Promise.resolve();
    }
    return Promise.resolve();
  });
  ipcMain.handle('cairn:repo:stars', () => fetchRepoStars());
  ipcMain.handle('cairn:config:read', () => readConfig());
  ipcMain.handle('cairn:config:set-local-git-enabled', (_e, enabled: unknown) =>
    setLocalGitEnabled(enabled === true),
  );
  ipcMain.handle('cairn:recent:list', () => listRecentMerged());
  ipcMain.handle('cairn:snapshots:list', (_e, category: RecentCategory, date: string) =>
    listJournalSnapshots(category, date),
  );
  ipcMain.handle(
    'cairn:snapshots:read',
    (_e, category: RecentCategory, date: string, stamp: string) =>
      readJournalSnapshot(category, date, stamp),
  );
  ipcMain.handle(
    'cairn:snapshots:restore',
    async (_e, category: RecentCategory, date: string, stamp: string) => {
      const r = await restoreJournalSnapshot(category, date, stamp);
      if (r.ok) scheduleJournalBackup();
      return r;
    },
  );
  ipcMain.handle('cairn:backup:status', () => getJournalBackupStatus());
  ipcMain.handle('cairn:backup:now', () => runJournalBackupNow());
  ipcMain.handle('cairn:notion:page-content', (_e, pageId: string, workspaceLabel: string) =>
    readPageBlocks(pageId, workspaceLabel),
  );
  // 프로젝트 뷰 스캔 — 여러 페이지 Done 불릿을 한 번에 (페이지당 IPC 왕복·전체 blocks 직렬화 제거)
  ipcMain.handle('cairn:reports:done', (_e, refs: ReportsDoneRef[]) => scanReportsDone(refs));

  ipcMain.on('cairn:bootstrap-sync', (e) => {
    e.returnValue = {
      settings: readSettings(),
      version: __WORKSPACE_VERSION__,
      setupComplete: isSetupComplete(),
    };
  });
  ipcMain.handle('cairn:settings:set', (_e, patch: Partial<Settings>) => {
    // IPC 경계 — truthy 문자열이 백업을 켜는 것 방지
    if (patch.backup) patch.backup = { enabled: patch.backup.enabled === true };
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
    if (patch.backup) reconfigureJournalBackup();
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
  ipcMain.handle('cairn:onboarding:probe-repo', (_e, path: string) =>
    probeLocalRepo(String(path ?? '')),
  );
  ipcMain.handle('cairn:connections:accounts', () => probeConnectionAccounts());
  ipcMain.handle('cairn:integrations:add-notion', (_e, raw: unknown) => {
    const parsed = parseNotionWorkspacePayload(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return addNotionWorkspace(parsed.entry);
  });
  ipcMain.handle('cairn:onboarding:finish', (_e, raw: unknown) => {
    const parsed = parseOnboardingPayload(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const result = finishOnboarding(parsed.payload);
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

  const initial = readSettings();
  applyLoginItem(initial.launchAtLogin);
  initAutoPublish();
  initJournalBackup();
  initTelemetry();
  trackAppLaunched();
  initUpdater();

  app.on('activate', () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  // 시스템 종료/재시작은 Cmd+Q(트레이 상주)와 달리 진짜 종료 — before-quit 의
  // preventDefault 가 macOS 종료 절차를 중단시키던 문제 방지
  powerMonitor.on('shutdown', () => {
    allowQuit = true;
    app.quit();
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
