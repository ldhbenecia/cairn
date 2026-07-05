export interface AgentUsage {
  resultSubtype: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model?: string;
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

export async function accumulateAgentUsage(q: AsyncIterable<unknown>): Promise<AgentUsage> {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let resultSubtype = 'unknown';
  let model: string | undefined;
  let modelOutputMax = -1;
  for await (const message of q) {
    const m = message as ResultMessage;
    if (m.type !== 'result') continue;
    resultSubtype = m.subtype ?? 'unknown';
    if (typeof m.total_cost_usd === 'number') costUsd = m.total_cost_usd;
    if (m.modelUsage) {
      for (const [id, u] of Object.entries(m.modelUsage)) {
        inputTokens +=
          num(u.inputTokens) + num(u.cacheReadInputTokens) + num(u.cacheCreationInputTokens);
        outputTokens += num(u.outputTokens);
        // 여러 모델이 섞이면(오버로드 fallback 등) 출력을 가장 많이 낸 모델을 대표로
        if (num(u.outputTokens) > modelOutputMax) {
          modelOutputMax = num(u.outputTokens);
          model = id;
        }
      }
    }
  }
  return { resultSubtype, inputTokens, outputTokens, costUsd, ...(model ? { model } : {}) };
}
