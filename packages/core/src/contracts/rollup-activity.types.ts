import type { CairnError } from '../common/error.js';

export type RollupPeriod = 'weekly' | 'monthly';

export interface RollupDailyPageMeta {
  date: string;
  pageId: string;
  url: string;
  prCount: number;
  commitCount: number;
  notionPageCount: number;
}

export interface RollupDailySummaryText {
  date: string;
  paragraphKo: string;
  doneBullets: readonly string[];
  inProgressBullets: readonly string[];
  notesBullets: readonly string[];
}

export interface RollupMetrics {
  prCount: number;
  commitCount: number;
  notionPageCount: number;
  dailyCount: number;
}

export interface RollupActivity {
  period: RollupPeriod;
  rangeStart: string;
  rangeEnd: string;
  dailies: readonly RollupDailyPageMeta[];
  summaries: readonly RollupDailySummaryText[];
  metrics: RollupMetrics;
  error?: CairnError;
}
