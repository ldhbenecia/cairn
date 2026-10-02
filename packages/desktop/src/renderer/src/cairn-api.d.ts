import type {
  BackupStatus,
  BusyState,
  CloudAuthState,
  ConfigResult,
  ConnectionAccounts,
  CoreMode,
  CoreResult,
  CoreRunOptions,
  ExportStatus,
  GithubProbe,
  JournalSearchHit,
  JournalSnapshotMeta,
  LocalRepoProbe,
  NotionDb,
  NotionPage,
  NotionProbe,
  NotionWorkspacePayload,
  OnboardingPayload,
  PageContent,
  PeriodDocRange,
  PeriodDocResult,
  RecentCategory,
  RecentListResult,
  RunLine,
  RunProgress,
  RunSnapshot,
  RunStep,
  SaveResult,
  Settings,
} from '../../shared/ipc-types';

declare global {
  interface Window {
    cairn: {
      version: string;
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
          logins?: string[];
          error?: string;
        }>;
        probeGithubGh: (login: string) => Promise<GithubProbe>;
        probeClaude: () => Promise<{ ok: boolean }>;
        probeRepo: (path: string) => Promise<LocalRepoProbe>;
        finish: (payload: OnboardingPayload) => Promise<{ ok: boolean; error?: string }>;
        pickFolder: () => Promise<string | null>;
      };
      connections: {
        accounts: () => Promise<ConnectionAccounts>;
        refreshGithub: () => Promise<{ ok: boolean; count?: number; error?: string }>;
      };
      integrations: {
        addNotion: (payload: NotionWorkspacePayload) => Promise<{ ok: boolean; error?: string }>;
      };
      cloud: {
        state: () => Promise<CloudAuthState>;
        validate: () => Promise<'ok' | 'expired' | 'unreachable' | 'signed-out'>;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
        syncNow: () => Promise<void>;
        onChanged: (cb: (s: CloudAuthState) => void) => () => void;
        onStatsSynced: (cb: () => void) => () => void;
      };
      run: (mode: CoreMode, options?: CoreRunOptions) => Promise<CoreResult>;
      busyState: () => Promise<BusyState>;
      runSnapshot: () => Promise<RunSnapshot>;
      cancelRun: () => Promise<boolean>;
      onBusy: (cb: (s: BusyState) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
      exportMarkdown: (defaultName: string, content: string) => Promise<SaveResult>;
      periodDoc: {
        generate: (range: PeriodDocRange) => Promise<PeriodDocResult>;
        read: (range: PeriodDocRange) => Promise<string | null>;
        reveal: (range: PeriodDocRange) => Promise<void>;
      };
      pickExportFolder: () => Promise<string | null>;
      exportStatus: () => Promise<ExportStatus>;
      revealExportFolder: () => Promise<string>;
      testNotification: () => Promise<{ supported: boolean }>;
      exportPdf: (defaultName: string, html: string) => Promise<SaveResult>;
      exportPng: (defaultName: string, dataUrl: string) => Promise<SaveResult>;
      repoStars: () => Promise<number | null>;
      onRunLine: (cb: (l: RunLine) => void) => () => void;
      onFocusMode: (cb: (mode: CoreMode) => void) => () => void;
      onOpenConnections: (cb: () => void) => () => void;
      autoConfirm: {
        accept: () => Promise<void>;
        dismiss: () => Promise<void>;
        onPending: (cb: (modes: CoreMode[] | null) => void) => () => void;
      };
      onRunStep: (cb: (p: { mode: CoreMode; step: RunStep }) => void) => () => void;
      onRunProgress: (cb: (p: { mode: CoreMode } & RunProgress) => void) => () => void;
      onRunDone: (cb: (p: { mode: CoreMode; result: CoreResult }) => void) => () => void;
      readConfig: () => Promise<ConfigResult>;
      setLocalGitEnabled: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
      listRecent: () => Promise<RecentListResult>;
      journalSearch: (query: string) => Promise<JournalSearchHit[]>;
      pageContent: (pageId: string, workspaceLabel: string) => Promise<PageContent>;
      reportsDone: (
        refs: {
          pageId: string;
          workspaceLabel: string;
          date: string | null;
          category: RecentCategory;
        }[],
      ) => Promise<{ pageId: string; bullets: string[]; failed: boolean }[]>;
      backup: {
        status: () => Promise<BackupStatus>;
        now: () => Promise<BackupStatus>;
      };
      snapshots: {
        list: (category: RecentCategory, date: string) => Promise<JournalSnapshotMeta[]>;
        read: (
          category: RecentCategory,
          date: string,
          stamp: string,
        ) => Promise<{ content: string | null }>;
        restore: (
          category: RecentCategory,
          date: string,
          stamp: string,
        ) => Promise<{ ok: boolean }>;
      };
    };
  }
}
