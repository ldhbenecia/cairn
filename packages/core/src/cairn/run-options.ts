export type RunMode = 'daily' | 'weekly' | 'monthly';

export type RunSource = 'github' | 'local-git';

export interface RunOptions {
  mode: RunMode;
  date: string;
  dateExplicit: boolean;
  dryRun: boolean;
  force: boolean;
  backfillDays: number;
  lookbackDays: number;
  sources: readonly RunSource[] | 'all';
}
