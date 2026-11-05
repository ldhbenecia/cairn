export type SummaryProvider = 'claude' | 'codex';

export function summaryProvider(): SummaryProvider {
  return process.env.CAIRN_SUMMARY_PROVIDER?.trim().toLowerCase() === 'codex' ? 'codex' : 'claude';
}

// argv 로 넘어가는 값 — 모델 id 형식이 아니면 무시하고 계정 기본 모델 사용
export function codexModel(): string | undefined {
  const v = process.env.CAIRN_CODEX_MODEL?.trim();
  return v && /^[a-z0-9][a-z0-9.-]{0,63}$/.test(v) ? v : undefined;
}
