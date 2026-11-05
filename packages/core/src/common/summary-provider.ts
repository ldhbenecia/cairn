export type SummaryProvider = 'claude' | 'codex';

export function summaryProvider(): SummaryProvider {
  return process.env.CAIRN_SUMMARY_PROVIDER?.trim().toLowerCase() === 'codex' ? 'codex' : 'claude';
}
