export type RunMode = 'daily' | 'weekly' | 'monthly';

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
  // 이번 실행에서 노션 발행만 제외 — journal(1차 기록)·통계는 그대로 (발행 대상 선택)
  skipNotion: boolean;
}
