export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = { backfillDays?: number; force?: boolean };

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

export type ConfigResult = { raw: string | null; parsed: unknown; path: string };
export type LogTailResult = { lines: string[]; path: string | null };

export type RecentCategory = 'daily' | 'weekly' | 'monthly';

export type RecentPage = {
  pageId: string;
  url: string;
  title: string;
  date: string | null;
  status: string | null;
  category: RecentCategory;
  sourceCounts: string | null;
  workspaceLabel: string;
};

export type RecentListResult = { pages: RecentPage[]; warnings: string[] };

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
  noActivity: boolean;
  stderrTail: string;
};

export type RunLine = {
  mode: CoreMode;
  level: 'info' | 'err' | 'meta';
  line: string;
};

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';

export type NotionProbe = { ok: boolean; persons: { id: string; name: string }[]; error?: string };
export type NotionPage = { id: string; title: string };
export type NotionDb = { databaseId: string; dataSourceId: string; title: string };
export type GithubProbe = { ok: boolean; login?: string; error?: string };
export type DbRef = { databaseId: string; dataSourceId: string };
export type OnboardingPayload = {
  notion: {
    label: string;
    token: string;
    pageId: string;
    myUserId: string;
    worklogDb?: DbRef;
    rollupDb?: DbRef;
  }[];
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
export type Settings = {
  theme: Theme;
  accent: string;
  language: Language;
  notifications: boolean;
  telemetry: boolean;
  autoPublish: AutoPublish;
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
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
        probeClaude: () => Promise<{ ok: boolean }>;
        finish: (payload: OnboardingPayload) => Promise<{ ok: boolean; error?: string }>;
        pickFolder: () => Promise<string | null>;
      };
      run: (mode: CoreMode, options?: CoreRunOptions) => Promise<CoreResult>;
      running: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      repoStars: () => Promise<number | null>;
      onRunLine: (cb: (l: RunLine) => void) => () => void;
      onFocusMode: (cb: (mode: CoreMode) => void) => () => void;
      onRunStep: (cb: (p: { mode: CoreMode; step: RunStep }) => void) => () => void;
      readConfig: () => Promise<ConfigResult>;
      tailLogs: () => Promise<LogTailResult>;
      listRecent: () => Promise<RecentListResult>;
      pageContent: (pageId: string, workspaceLabel: string) => Promise<PageContent>;
    };
  }
}
