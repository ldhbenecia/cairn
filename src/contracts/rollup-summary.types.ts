import type { WorklogSummaryUsage } from './worklog-summary.types.js';

export interface RollupTheme {
  title: string;
  items: readonly string[];
}

export interface RollupSummary {
  paragraphKo: string;
  themes: readonly RollupTheme[];
  highlights: readonly string[];
  usage?: WorklogSummaryUsage;
}
