import type { CairnError } from '../common/error.js';

export type RollupPeriod = 'weekly' | 'monthly' | 'yearly';

export interface RollupDailyPageMeta {
  date: string;
  pageId: string;
  url: string;
  prCount: number;
  commitCount: number;
}

export interface RollupDailySummaryText {
  date: string;
  paragraph: string;
  doneBullets: readonly string[];
  reviewedBullets: readonly string[];
  inProgressBullets: readonly string[];
  notesBullets: readonly string[];
}

export interface RollupMetrics {
  prCount: number;
  commitCount: number;
  dailyCount: number;
}

// AI 해설(commentary)용 직전 기간 컨텍스트 — 메트릭은 로컬 통계, paragraph 는 직전 롤업 journal
export interface RollupPreviousContext {
  rangeStart: string;
  rangeEnd: string;
  prCount: number;
  commitCount: number;
  paragraph: string | null;
}

export interface RollupActivity {
  period: RollupPeriod;
  rangeStart: string;
  rangeEnd: string;
  dailies: readonly RollupDailyPageMeta[];
  summaries: readonly RollupDailySummaryText[];
  metrics: RollupMetrics;
  previous?: RollupPreviousContext;
  error?: CairnError;
}
