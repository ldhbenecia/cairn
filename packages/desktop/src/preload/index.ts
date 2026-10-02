import { contextBridge, ipcRenderer } from 'electron';

function subscribe<T>(channel: string): (cb: (payload: T) => void) => () => void {
  return (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  };
}

function subscribeSignal(channel: string): (cb: () => void) => () => void {
  return (cb) => {
    const listener = (): void => cb();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  };
}

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
export type BackupConfig = { enabled: boolean };
export type BackupStatus = {
  state: 'disabled' | 'no-git' | 'no-repo' | 'idle' | 'syncing';
  hasRemote: boolean;
  lastBackupAt: number | null;
  error: 'pull-failed' | 'identity-missing' | 'commit-failed' | 'push-failed' | null;
};
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
  backup: BackupConfig;
};

// 첫 페인트 전 동기로 설정 수신 (무플래시) — sandbox preload 라 fs 불가해 sendSync
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

export type PeriodDocRange = { since: string; until: string };
export type PeriodDocResult =
  | { status: 'ok'; fileName: string; content: string }
  | { status: 'empty' }
  | { status: 'fail'; hint: CoreResult['failureHint'] };
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
  failureHint:
    | 'auth'
    | 'claude-auth'
    | 'quota'
    | 'summarize'
    | 'network'
    | 'notion'
    | 'collect'
    | null;
  journalWriteFailed: boolean;
  collectPartial: string[];
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
        logins?: string[];
        error?: string;
      }>,
    probeGithubGh: (login: string) =>
      ipcRenderer.invoke('cairn:onboarding:probe-github-gh', login) as Promise<unknown>,
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
        github: {
          label: string;
          login?: string;
          health: 'ok' | 'invalid' | 'missing' | 'unreachable';
        }[];
        notion: {
          label: string;
          workspace?: string;
          health: 'ok' | 'invalid' | 'missing' | 'unreachable';
        }[];
      }>,
    refreshGithub: () =>
      ipcRenderer.invoke('cairn:connections:refresh-github') as Promise<{
        ok: boolean;
        count?: number;
        error?: string;
      }>,
  },
  integrations: {
    addNotion: (payload: unknown) =>
      ipcRenderer.invoke('cairn:integrations:add-notion', payload) as Promise<unknown>,
  },
  cloud: {
    state: () => ipcRenderer.invoke('cairn:auth:state') as Promise<CloudAuthState>,
    validate: () =>
      ipcRenderer.invoke('cairn:auth:validate') as Promise<
        'ok' | 'expired' | 'unreachable' | 'signed-out'
      >,
    signIn: () => ipcRenderer.invoke('cairn:auth:sign-in') as Promise<void>,
    signOut: () => ipcRenderer.invoke('cairn:auth:sign-out') as Promise<void>,
    syncNow: () => ipcRenderer.invoke('cairn:sync:now') as Promise<void>,
    onChanged: subscribe<CloudAuthState>('cairn:auth:changed'),
    onStatsSynced: subscribeSignal('cairn:stats:synced'),
  },
  run: (mode: CoreMode, options?: CoreRunOptions): Promise<CoreResult> =>
    ipcRenderer.invoke('cairn:run', mode, options) as Promise<CoreResult>,
  cancelRun: (): Promise<boolean> => ipcRenderer.invoke('cairn:run-cancel') as Promise<boolean>,
  busyState: (): Promise<BusyState> => ipcRenderer.invoke('cairn:busy-state') as Promise<BusyState>,
  runSnapshot: (): Promise<RunSnapshot> =>
    ipcRenderer.invoke('cairn:run-snapshot') as Promise<RunSnapshot>,
  onBusy: subscribe<BusyState>('cairn:busy'),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('cairn:open-external', url) as Promise<void>,
  exportMarkdown: (defaultName: string, content: string): Promise<SaveResult> =>
    ipcRenderer.invoke('cairn:export:save-markdown', defaultName, content) as Promise<SaveResult>,
  periodDoc: {
    generate: (range: PeriodDocRange): Promise<PeriodDocResult> =>
      ipcRenderer.invoke('cairn:period-doc:generate', range) as Promise<PeriodDocResult>,
    read: (range: PeriodDocRange): Promise<string | null> =>
      ipcRenderer.invoke('cairn:period-doc:read', range) as Promise<string | null>,
    reveal: (range: PeriodDocRange): Promise<void> =>
      ipcRenderer.invoke('cairn:period-doc:reveal', range) as Promise<void>,
  },
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
  exportPng: (defaultName: string, dataUrl: string): Promise<SaveResult> =>
    ipcRenderer.invoke('cairn:export:save-png', defaultName, dataUrl) as Promise<SaveResult>,
  repoStars: (): Promise<number | null> =>
    ipcRenderer.invoke('cairn:repo:stars') as Promise<number | null>,
  onRunLine: subscribe<RunLine>('cairn:run-line'),
  onFocusMode: subscribe<CoreMode>('cairn:focus-mode'),
  onOpenConnections: subscribeSignal('cairn:open-connections'),
  autoConfirm: {
    accept: (): Promise<void> => ipcRenderer.invoke('cairn:auto-confirm:accept') as Promise<void>,
    dismiss: (): Promise<void> => ipcRenderer.invoke('cairn:auto-confirm:dismiss') as Promise<void>,
    onPending: subscribe<CoreMode[] | null>('cairn:auto-confirm'),
  },
  onRunProgress: subscribe<{ mode: CoreMode } & RunProgress>('cairn:run-progress'),
  onRunStep: subscribe<{ mode: CoreMode; step: RunStep }>('cairn:run-step'),
  onRunDone: subscribe<{ mode: CoreMode; result: CoreResult }>('cairn:run-done'),
  readConfig: (): Promise<ConfigResult> =>
    ipcRenderer.invoke('cairn:config:read') as Promise<ConfigResult>,
  setLocalGitEnabled: (enabled: boolean): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('cairn:config:set-local-git-enabled', enabled) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  listRecent: (): Promise<RecentListResult> =>
    ipcRenderer.invoke('cairn:recent:list') as Promise<RecentListResult>,
  journalSearch: (query: string): Promise<unknown> =>
    ipcRenderer.invoke('cairn:journal:search', query) as Promise<unknown>,
  pageContent: (pageId: string, workspaceLabel: string): Promise<unknown> =>
    ipcRenderer.invoke('cairn:notion:page-content', pageId, workspaceLabel) as Promise<unknown>,
  reportsDone: (refs: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('cairn:reports:done', refs) as Promise<unknown>,
  backup: {
    status: (): Promise<BackupStatus> =>
      ipcRenderer.invoke('cairn:backup:status') as Promise<BackupStatus>,
    now: (): Promise<BackupStatus> =>
      ipcRenderer.invoke('cairn:backup:now') as Promise<BackupStatus>,
  },
  snapshots: {
    list: (category: string, date: string): Promise<{ stamp: string; at: string }[]> =>
      ipcRenderer.invoke('cairn:snapshots:list', category, date) as Promise<
        { stamp: string; at: string }[]
      >,
    read: (category: string, date: string, stamp: string): Promise<{ content: string | null }> =>
      ipcRenderer.invoke('cairn:snapshots:read', category, date, stamp) as Promise<{
        content: string | null;
      }>,
    restore: (category: string, date: string, stamp: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('cairn:snapshots:restore', category, date, stamp) as Promise<{
        ok: boolean;
      }>,
  },
});
