export type RunMode = 'daily' | 'weekly' | 'monthly';

export type RunSource = 'github' | 'local-git' | 'notion';

export interface RunOptions {
  mode: RunMode;
  date: string;
  dateExplicit: boolean;
  dryRun: boolean;
  force: boolean;
  backfillDays: number;
  sources: readonly RunSource[] | 'all';
}
