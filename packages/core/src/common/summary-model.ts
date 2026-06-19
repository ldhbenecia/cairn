const FALLBACK: Record<string, string> = {
  sonnet: 'opus',
  haiku: 'sonnet',
  opus: 'sonnet',
};

export function summaryModelOption(): { model?: string; fallbackModel?: string } {
  const v = process.env.CAIRN_SUMMARY_MODEL?.trim().toLowerCase();
  if (!v || !(v in FALLBACK)) return {};
  return { model: v, fallbackModel: FALLBACK[v] };
}
