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

declare global {
  interface Window {
    cairn: {
      version: string;
      isPackaged: boolean;
      run: (mode: CoreMode, options?: CoreRunOptions) => Promise<CoreResult>;
      running: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      onRunLine: (cb: (l: RunLine) => void) => () => void;
      onFocusMode: (cb: (mode: CoreMode) => void) => () => void;
      onRunStep: (cb: (p: { mode: CoreMode; step: RunStep }) => void) => () => void;
      readConfig: () => Promise<ConfigResult>;
      tailLogs: () => Promise<LogTailResult>;
      listRecent: () => Promise<RecentListResult>;
    };
  }
}
