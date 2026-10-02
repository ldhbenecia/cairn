// main ↔ preload ↔ renderer IPC 계약 타입의 단일 정의 — main 원본 모듈은 여기서 가져와 다시 내보냄

export type CoreMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type CoreRunOptions = {
  backfillDays?: number;
  force?: boolean;
  date?: string;
  skipNotion?: boolean;
};

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type FailureHint =
  | 'auth'
  | 'claude-auth'
  | 'quota'
  | 'summarize'
  | 'network'
  | 'notion'
  | 'collect'
  | null;

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

export type RecentCategory = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type JournalSnapshotMeta = { stamp: string; at: string };

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
  sinks?: WorklogSink[]; // 구버전 로컬 캐시에는 없음
};

export type RecentWarning =
  | { code: 'no-workspaces' }
  | { code: 'token-missing'; workspace: string; tokenEnv: string }
  | { code: 'no-data-source'; workspace: string }
  | { code: 'fetch-failed'; workspace: string; kind: 'worklog' | 'rollup'; detail: string };

export type RecentListResult = { pages: RecentPage[]; warnings: RecentWarning[] };

export type JournalSearchHit = {
  fileName: string;
  category: RecentCategory;
  snippet: string;
  matchCount: number;
};

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
  failureHint: FailureHint;
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
export type AccountHealth = 'ok' | 'invalid' | 'missing' | 'unreachable';
export type ConnectionAccounts = {
  github: { label: string; login?: string; health: AccountHealth }[];
  notion: { label: string; workspace?: string; health: AccountHealth }[];
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
  github: ({ label: string; token: string } | { label: string; ghLogin: string })[];
  anthropicApiKey?: string;
  localGitRepos: string[];
};
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
