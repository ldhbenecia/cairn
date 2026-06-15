import { contextBridge, ipcRenderer } from 'electron';

const IS_PACKAGED = process.argv.includes('--cairn-packaged');

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';
export type SummaryModel = 'default' | 'sonnet' | 'haiku' | 'opus';
export type AutoPublish = {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  time: string;
  backfillDays: number;
  confirmBeforeRun: boolean;
};
export type Settings = {
  theme: Theme;
  accent: string;
  liquidGlass: boolean;
  language: Language;
  notifications: boolean;
  telemetry: boolean;
  installId: string;
  autoPublish: AutoPublish;
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
  summaryModel: SummaryModel;
};

// 무플래시: 첫 페인트 전에 main 에서 동기로 설정·버전을 받아온다 (sandbox preload 라 fs 불가 → sendSync)
const boot = ipcRenderer.sendSync('cairn:bootstrap-sync') as {
  settings: Settings;
  version: string;
  setupComplete: boolean;
};

export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = { backfillDays?: number; force?: boolean };

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

export type BusyState = { busy: boolean; mode: CoreMode | null };

export type ConfigResult = { raw: string | null; parsed: unknown; path: string };
export type LogTailResult = { lines: string[]; path: string | null };

export type RecentPage = {
  pageId: string;
  url: string;
  title: string;
  date: string | null;
  status: string | null;
  workspaceLabel: string;
};

export type RecentListResult = { pages: RecentPage[]; warnings: string[] };

export type CoreResult = {
  ok: boolean;
  exitCode: number | null;
  notionUrl: string | null;
  publishKind: PublishKind;
  publishPageId: string | null;
  noActivity: boolean;
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
    probeClaude: () => ipcRenderer.invoke('cairn:onboarding:probe-claude') as Promise<unknown>,
    finish: (payload: unknown) =>
      ipcRenderer.invoke('cairn:onboarding:finish', payload) as Promise<unknown>,
    pickFolder: () => ipcRenderer.invoke('cairn:onboarding:pick-folder') as Promise<string | null>,
  },
  run: (mode: CoreMode, options?: CoreRunOptions): Promise<CoreResult> =>
    ipcRenderer.invoke('cairn:run', mode, options) as Promise<CoreResult>,
  running: (): Promise<boolean> => ipcRenderer.invoke('cairn:running') as Promise<boolean>,
  busyState: (): Promise<BusyState> => ipcRenderer.invoke('cairn:busy-state') as Promise<BusyState>,
  onBusy: (cb: (s: BusyState) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: BusyState): void => cb(payload);
    ipcRenderer.on('cairn:busy', listener);
    return () => ipcRenderer.off('cairn:busy', listener);
  },
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('cairn:open-external', url) as Promise<void>,
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
  onRunStep: (cb: (payload: { mode: CoreMode; step: RunStep }) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { mode: CoreMode; step: RunStep },
    ): void => cb(payload);
    ipcRenderer.on('cairn:run-step', listener);
    return () => ipcRenderer.off('cairn:run-step', listener);
  },
  readConfig: (): Promise<ConfigResult> =>
    ipcRenderer.invoke('cairn:config:read') as Promise<ConfigResult>,
  tailLogs: (): Promise<LogTailResult> =>
    ipcRenderer.invoke('cairn:logs:tail') as Promise<LogTailResult>,
  listRecent: (): Promise<RecentListResult> =>
    ipcRenderer.invoke('cairn:recent:list') as Promise<RecentListResult>,
  pageContent: (pageId: string, workspaceLabel: string): Promise<unknown> =>
    ipcRenderer.invoke('cairn:notion:page-content', pageId, workspaceLabel) as Promise<unknown>,
});
