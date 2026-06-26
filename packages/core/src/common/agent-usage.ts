export interface AgentUsage {
  resultSubtype: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface ModelUsageEntry {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

interface ResultMessage {
  type?: string;
  subtype?: string;
  total_cost_usd?: number;
  modelUsage?: Record<string, ModelUsageEntry>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

// Claude agent query 의 result 메시지에서 토큰·비용을 누적 — daily/rollup summarizer 공용.
// SDK 가 modelUsage 필드/캐시 합산을 바꾸면 여기 한 곳만 고치면 되도록 단일 출처로 둔다.
export async function accumulateAgentUsage(q: AsyncIterable<unknown>): Promise<AgentUsage> {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let resultSubtype = 'unknown';
  for await (const message of q) {
    const m = message as ResultMessage;
    if (m.type !== 'result') continue;
    resultSubtype = m.subtype ?? 'unknown';
    if (typeof m.total_cost_usd === 'number') costUsd = m.total_cost_usd;
    if (m.modelUsage) {
      for (const u of Object.values(m.modelUsage)) {
        inputTokens +=
          num(u.inputTokens) + num(u.cacheReadInputTokens) + num(u.cacheCreationInputTokens);
        outputTokens += num(u.outputTokens);
      }
    }
  }
  return { resultSubtype, inputTokens, outputTokens, costUsd };
}
