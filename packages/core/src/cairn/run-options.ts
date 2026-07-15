export type RunMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RunSource = 'github' | 'local-git';

export type WorklogLang = 'ko' | 'en';

export interface RunOptions {
  mode: RunMode;
  date: string;
  dateExplicit: boolean;
  dryRun: boolean;
  force: boolean;
  backfillDays: number;
  lookbackDays: number;
  sources: readonly RunSource[] | 'all';
  lang: WorklogLang;
  // 노션만 제외 — journal·통계 유지
  skipNotion: boolean;
}
