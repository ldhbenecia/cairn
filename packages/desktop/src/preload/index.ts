import { contextBridge, ipcRenderer } from 'electron';

const IS_PACKAGED = process.argv.includes('--cairn-packaged');

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';
export type SummaryModel = 'default' | 'sonnet' | 'haiku' | 'opus';
export type AutoPublish = {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  yearly: boolean;
  time: string;
  backfillDays: number;
  confirmBeforeRun: boolean;
};
export type ExportConfig = { folder: string | null; autoSync: boolean };
export type GraphLabels = 'auto' | 'always' | 'hover';
export type GraphConfig = {
  enabled: boolean;
  nodeScale: number;
  spread: number;
  gravity: number;
  labels: GraphLabels;
  showRollups: boolean;
};
export type QuickCaptureConfig = { enabled: boolean; shortcut: string };
export type Settings = {
  theme: Theme;
  accent: string;
  liquidGlass: boolean;
  language: Language;
  notifications: boolean;
  launchAtLogin: boolean;
  telemetry: boolean;
  installId: string;
  autoPublish: AutoPublish;
  prompts: {
    daily: string | null;
    weekly: string | null;
    monthly: string | null;
    yearly: string | null;
  };
  summaryModel: SummaryModel;
  export: ExportConfig;
  graph: GraphConfig;
  quickCapture: QuickCaptureConfig;
};

// 무플래시: 첫 페인트 전 동기로 설정을 받는다 (sandbox preload 라 fs 불가 → sendSync)
const boot = ipcRenderer.sendSync('cairn:bootstrap-sync') as {
  settings: Settings;
  version: string;
  setupComplete: boolean;
};

export type CoreMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type CoreRunOptions = {
  backfillDays?: number;
  force?: boolean;
  date?: string;
  skipNotion?: boolean;
};

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

export type BusyState = { busy: boolean; mode: CoreMode | null };

export type DateStep = 'collect' | 'summarize' | 'publish';
export type DateCounts = { pr: number; commit: number };
export type RunProgress = {
  total: number;
  done: number;
  active: number;
  dates: string[];
  doneDates: string[];
  failedDates: string[];
  stepByDate: Record<string, DateStep>;
  countsByDate: Record<string, DateCounts>;
};

export type RunSnapshot = {
  busy: boolean;
  mode: CoreMode | null;
  step: RunStep;
  startedAt: number;
  progress: RunProgress | null;
  lastResult: { mode: CoreMode; result: CoreResult; endedAt: number } | null;
};

export type SaveResult = { saved: boolean; path?: string; error?: string };
export type ExportStatus = {
  folder: string | null;
  isVault: boolean;
  fileCount: number;
  lastSyncAt: number | null;
};

export type ConfigResult = { raw: string | null; parsed: unknown; path: string };

export type WorklogSink = 'journal' | 'notion' | 'obsidian';

export type RecentPage = {
  pageId: string;
  url: string;
  title: string;
  date: string | null;
  status: string | null;
  category: 'daily' | 'weekly' | 'monthly' | 'yearly';
  pr: number | null;
  commit: number | null;
  hours: number[] | null;
  workspaceLabel: string;
  sinks?: WorklogSink[];
};

export type CloudUser = { name: string; email: string; image: string | null };
export type CloudAuthState = { signedIn: boolean; user: CloudUser | null };

export type RecentWarning =
  | { code: 'no-workspaces' }
  | { code: 'token-missing'; workspace: string; tokenEnv: string }
  | { code: 'no-data-source'; workspace: string }
  | { code: 'fetch-failed'; workspace: string; kind: 'worklog' | 'rollup'; detail: string };

export type RecentListResult = { pages: RecentPage[]; warnings: RecentWarning[] };

export type CoreResult = {
  ok: boolean;
  exitCode: number | null;
  notionUrl: string | null;
  publishKind: PublishKind;
  publishPageId: string | null;
  journalFile: string | null;
  noActivity: boolean;
  cancelled: boolean;
  summaryFailed: boolean;
  failureHint: 'auth' | 'quota' | 'network' | 'notion' | 'collect' | null;
  journalWriteFailed: boolean;
  prCount: number;
  commitCount: number;
  stderrTail: string;
};

export type RunLine = {
  mode: CoreMode;
  level: 'info' | 'err' | 'meta';
  line: string;
};

contextBridge.exposeInMainWorld('cairn', {
  version: boot.version,
  isPackaged: IS_PACKAGED,
  initialSettings: boot.settings,
  initialSetupComplete: boot.setupComplete,
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('cairn:settings:set', patch) as Promise<Settings>,
  onboarding: {
    probeNotion: (token: string) =>
      ipcRenderer.invoke('cairn:onboarding:probe-notion', token) as Promise<unknown>,
    searchNotion: (token: string, query?: string) =>
      ipcRenderer.invoke('cairn:onboarding:search-notion', token, query) as Promise<unknown>,
    listDatabases: (token: string, pageId: string) =>
      ipcRenderer.invoke('cairn:onboarding:list-databases', token, pageId) as Promise<unknown>,
    probeGithub: (token: string) =>
      ipcRenderer.invoke('cairn:onboarding:probe-github', token) as Promise<unknown>,
    githubFromGhCli: () =>
      ipcRenderer.invoke('cairn:onboarding:github-from-gh') as Promise<{
        ok: boolean;
        accounts?: { login: string; token: string }[];
        error?: string;
      }>,
    probeClaude: () => ipcRenderer.invoke('cairn:onboarding:probe-claude') as Promise<unknown>,
    probeRepo: (path: string) =>
      ipcRenderer.invoke('cairn:onboarding:probe-repo', path) as Promise<{
        ok: boolean;
        reason?: 'not-git' | 'no-email';
      }>,
    finish: (payload: unknown) =>
      ipcRenderer.invoke('cairn:onboarding:finish', payload) as Promise<unknown>,
    pickFolder: () => ipcRenderer.invoke('cairn:onboarding:pick-folder') as Promise<string | null>,
  },
  connections: {
    accounts: () =>
      ipcRenderer.invoke('cairn:connections:accounts') as Promise<{
        github: { label: string; login?: string }[];
        notion: { label: string; workspace?: string }[];
      }>,
  },
  integrations: {
    addNotion: (payload: unknown) =>
      ipcRenderer.invoke('cairn:integrations:add-notion', payload) as Promise<unknown>,
  },
  cloud: {
    state: () => ipcRenderer.invoke('cairn:auth:state') as Promise<CloudAuthState>,
    signIn: () => ipcRenderer.invoke('cairn:auth:sign-in') as Promise<void>,
    signOut: () => ipcRenderer.invoke('cairn:auth:sign-out') as Promise<void>,
    syncNow: () => ipcRenderer.invoke('cairn:sync:now') as Promise<void>,
    onChanged: (cb: (s: CloudAuthState) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, s: CloudAuthState): void => cb(s);
      ipcRenderer.on('cairn:auth:changed', listener);
      return () => ipcRenderer.off('cairn:auth:changed', listener);
    },
    onStatsSynced: (cb: () => void): (() => void) => {
      const listener = (): void => cb();
      ipcRenderer.on('cairn:stats:synced', listener);
      return () => ipcRenderer.off('cairn:stats:synced', listener);
    },
  },
  run: (mode: CoreMode, options?: CoreRunOptions): Promise<CoreResult> =>
    ipcRenderer.invoke('cairn:run', mode, options) as Promise<CoreResult>,
  cancelRun: (): Promise<boolean> => ipcRenderer.invoke('cairn:run-cancel') as Promise<boolean>,
  running: (): Promise<boolean> => ipcRenderer.invoke('cairn:running') as Promise<boolean>,
  busyState: (): Promise<BusyState> => ipcRenderer.invoke('cairn:busy-state') as Promise<BusyState>,
  runSnapshot: (): Promise<RunSnapshot> =>
    ipcRenderer.invoke('cairn:run-snapshot') as Promise<RunSnapshot>,
  onBusy: (cb: (s: BusyState) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: BusyState): void => cb(payload);
    ipcRenderer.on('cairn:busy', listener);
    return () => ipcRenderer.off('cairn:busy', listener);
  },
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('cairn:open-external', url) as Promise<void>,
  exportMarkdown: (defaultName: string, content: string): Promise<SaveResult> =>
    ipcRenderer.invoke('cairn:export:save-markdown', defaultName, content) as Promise<SaveResult>,
  pickExportFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('cairn:export:pick-folder') as Promise<string | null>,
  exportStatus: (): Promise<ExportStatus> =>
    ipcRenderer.invoke('cairn:export:status') as Promise<ExportStatus>,
  revealExportFolder: (): Promise<string> =>
    ipcRenderer.invoke('cairn:export:reveal') as Promise<string>,
  testNotification: (): Promise<{ supported: boolean }> =>
    ipcRenderer.invoke('cairn:notify:test') as Promise<{ supported: boolean }>,
  exportPdf: (defaultName: string, html: string): Promise<SaveResult> =>
    ipcRenderer.invoke('cairn:export:save-pdf', defaultName, html) as Promise<SaveResult>,
  repoStars: (): Promise<number | null> =>
    ipcRenderer.invoke('cairn:repo:stars') as Promise<number | null>,
  onRunLine: (cb: (l: RunLine) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: RunLine): void => cb(payload);
    ipcRenderer.on('cairn:run-line', listener);
    return () => ipcRenderer.off('cairn:run-line', listener);
  },
  onFocusMode: (cb: (mode: CoreMode) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, mode: CoreMode): void => cb(mode);
    ipcRenderer.on('cairn:focus-mode', listener);
    return () => ipcRenderer.off('cairn:focus-mode', listener);
  },
  onRunProgress: (cb: (payload: { mode: CoreMode } & RunProgress) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { mode: CoreMode } & RunProgress,
    ): void => cb(payload);
    ipcRenderer.on('cairn:run-progress', listener);
    return () => ipcRenderer.off('cairn:run-progress', listener);
  },
  onRunStep: (cb: (payload: { mode: CoreMode; step: RunStep }) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { mode: CoreMode; step: RunStep },
    ): void => cb(payload);
    ipcRenderer.on('cairn:run-step', listener);
    return () => ipcRenderer.off('cairn:run-step', listener);
  },
  onRunDone: (cb: (payload: { mode: CoreMode; result: CoreResult }) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { mode: CoreMode; result: CoreResult },
    ): void => cb(payload);
    ipcRenderer.on('cairn:run-done', listener);
    return () => ipcRenderer.off('cairn:run-done', listener);
  },
  readConfig: (): Promise<ConfigResult> =>
    ipcRenderer.invoke('cairn:config:read') as Promise<ConfigResult>,
  listRecent: (): Promise<RecentListResult> =>
    ipcRenderer.invoke('cairn:recent:list') as Promise<RecentListResult>,
  pageContent: (pageId: string, workspaceLabel: string): Promise<unknown> =>
    ipcRenderer.invoke('cairn:notion:page-content', pageId, workspaceLabel) as Promise<unknown>,
  capture: {
    add: (text: string): Promise<{ ok: boolean; count: number }> =>
      ipcRenderer.invoke('cairn:memo:add', text) as Promise<{ ok: boolean; count: number }>,
    open: (): Promise<void> => ipcRenderer.invoke('cairn:capture:open') as Promise<void>,
    hide: (): Promise<void> => ipcRenderer.invoke('cairn:capture:hide') as Promise<void>,
  },
});
