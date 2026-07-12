export type CoreMode = 'daily' | 'weekly' | 'monthly';

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

export type RecentCategory = 'daily' | 'weekly' | 'monthly';

export type WorklogSink = 'journal' | 'notion' | 'obsidian';

export type RecentPage = {
  pageId: string;
  url: string;
  title: string;
  date: string | null;
  status: string | null;
  category: RecentCategory;
  pr: number | null;
  commit: number | null;
  hours: number[] | null;
  workspaceLabel: string;
  // 구버전 로컬 캐시에는 없음 — optional
  sinks?: WorklogSink[];
};

export type RecentWarning =
  | { code: 'no-workspaces' }
  | { code: 'token-missing'; workspace: string; tokenEnv: string }
  | { code: 'no-data-source'; workspace: string }
  | { code: 'fetch-failed'; workspace: string; kind: 'worklog' | 'rollup'; detail: string };

export type RecentListResult = { pages: RecentPage[]; warnings: RecentWarning[] };

export type RichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  href?: string;
};
export type SimpleBlock = {
  id: string;
  type: string;
  rich: RichSpan[];
  checked?: boolean;
  language?: string;
  icon?: string;
  iconUrl?: string;
  children?: SimpleBlock[];
};
export type PageContent = { blocks: SimpleBlock[]; warning?: string };

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

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';
export type SummaryModel = 'default' | 'sonnet' | 'haiku' | 'opus';

export type CloudUser = { name: string; email: string; image: string | null };
export type CloudAuthState = { signedIn: boolean; user: CloudUser | null };

export type NotionProbe = { ok: boolean; persons: { id: string; name: string }[]; error?: string };
export type NotionPage = { id: string; title: string };
export type NotionDb = { databaseId: string; dataSourceId: string; title: string };
export type GithubProbe = { ok: boolean; login?: string; error?: string };
export type LocalRepoProbe = { ok: boolean; reason?: 'not-git' | 'no-email' };
export type ConnectionAccounts = {
  github: { label: string; login?: string }[];
  notion: { label: string; workspace?: string }[];
};
export type DbRef = { databaseId: string; dataSourceId: string };
export type NotionWorkspacePayload = {
  label: string;
  token: string;
  pageId: string;
  myUserId: string;
  worklogDb?: DbRef;
  rollupDb?: DbRef;
};
export type OnboardingPayload = {
  notion: NotionWorkspacePayload[];
  github: { label: string; token: string }[];
  anthropicApiKey?: string;
  localGitRepos: string[];
};
export type AutoPublish = {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
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
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
  summaryModel: SummaryModel;
  export: ExportConfig;
  graph: GraphConfig;
  quickCapture: QuickCaptureConfig;
};

declare global {
  interface Window {
    cairn: {
      version: string;
      isPackaged: boolean;
      initialSettings: Settings;
      initialSetupComplete: boolean;
      setSettings: (patch: Partial<Settings>) => Promise<Settings>;
      onboarding: {
        probeNotion: (token: string) => Promise<NotionProbe>;
        searchNotion: (token: string, query?: string) => Promise<NotionPage[]>;
        listDatabases: (token: string, pageId: string) => Promise<NotionDb[]>;
        probeGithub: (token: string) => Promise<GithubProbe>;
        githubFromGhCli: () => Promise<{
          ok: boolean;
          accounts?: { login: string; token: string }[];
          error?: string;
        }>;
        probeClaude: () => Promise<{ ok: boolean }>;
        probeRepo: (path: string) => Promise<LocalRepoProbe>;
        finish: (payload: OnboardingPayload) => Promise<{ ok: boolean; error?: string }>;
        pickFolder: () => Promise<string | null>;
      };
      connections: {
        accounts: () => Promise<ConnectionAccounts>;
      };
      integrations: {
        addNotion: (payload: NotionWorkspacePayload) => Promise<{ ok: boolean; error?: string }>;
      };
      cloud: {
        state: () => Promise<CloudAuthState>;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
        syncNow: () => Promise<void>;
        onChanged: (cb: (s: CloudAuthState) => void) => () => void;
        onStatsSynced: (cb: () => void) => () => void;
      };
      run: (mode: CoreMode, options?: CoreRunOptions) => Promise<CoreResult>;
      running: () => Promise<boolean>;
      busyState: () => Promise<BusyState>;
      runSnapshot: () => Promise<RunSnapshot>;
      cancelRun: () => Promise<boolean>;
      onBusy: (cb: (s: BusyState) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
      exportMarkdown: (defaultName: string, content: string) => Promise<SaveResult>;
      pickExportFolder: () => Promise<string | null>;
      exportStatus: () => Promise<ExportStatus>;
      revealExportFolder: () => Promise<string>;
      testNotification: () => Promise<{ supported: boolean }>;
      exportPdf: (defaultName: string, html: string) => Promise<SaveResult>;
      repoStars: () => Promise<number | null>;
      onRunLine: (cb: (l: RunLine) => void) => () => void;
      onFocusMode: (cb: (mode: CoreMode) => void) => () => void;
      onRunStep: (cb: (p: { mode: CoreMode; step: RunStep }) => void) => () => void;
      onRunProgress: (cb: (p: { mode: CoreMode } & RunProgress) => void) => () => void;
      onRunDone: (cb: (p: { mode: CoreMode; result: CoreResult }) => void) => () => void;
      readConfig: () => Promise<ConfigResult>;
      listRecent: () => Promise<RecentListResult>;
      pageContent: (pageId: string, workspaceLabel: string) => Promise<PageContent>;
      capture: {
        add: (text: string) => Promise<{ ok: boolean; count: number }>;
        open: () => Promise<void>;
        hide: () => Promise<void>;
      };
    };
  }
}
