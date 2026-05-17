export interface WorklogSummary {
  paragraphKo: string;
  doneBullets: readonly string[];
  inProgressBullets: readonly string[];
  notesBullets: readonly string[];
  usage?: WorklogSummaryUsage;
}

export interface WorklogSummaryUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
