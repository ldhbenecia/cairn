export interface WorklogSummary {
  paragraph: string;
  shareBullets: readonly string[];
  doneBullets: readonly string[];
  reviewedBullets: readonly string[];
  inProgressBullets: readonly string[];
  notesBullets: readonly string[];
  usage?: WorklogSummaryUsage;
}

export interface WorklogSummaryUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
