import type { WorklogSummaryUsage } from './worklog-summary.types.js';

export interface RollupTheme {
  title: string;
  items: readonly string[];
}

export interface RollupSummary {
  paragraph: string;
  themes: readonly RollupTheme[];
  highlights: readonly string[];
  usage?: WorklogSummaryUsage;
}
