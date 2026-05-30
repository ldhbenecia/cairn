export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = { backfillDays?: number };

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

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
      run: (mode: CoreMode, options?: CoreRunOptions) => Promise<CoreResult>;
      running: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      onRunLine: (cb: (l: RunLine) => void) => () => void;
      onFocusMode: (cb: (mode: CoreMode) => void) => () => void;
    };
  }
}
