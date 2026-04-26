export type RunMode = 'daily' | 'weekly' | 'monthly';

export type RunSource = 'github' | 'local-git' | 'notion';

export interface RunOptions {
  mode: RunMode;
  date: string;
  dryRun: boolean;
  force: boolean;
  sources: readonly RunSource[] | 'all';
}
