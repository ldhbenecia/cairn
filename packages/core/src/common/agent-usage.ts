export interface AgentUsage {
  resultSubtype: string;
  inputTokens: number;
  outputTokens: number;
  // 프롬프트 캐시 히트 확인용 분리 노출 (inputTokens 에는 합산돼 있음)
  cacheReadTokens: number;
  cacheCreationTokens: number;
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
  is_error?: boolean;
  result?: unknown;
  total_cost_usd?: number;
  modelUsage?: Record<string, ModelUsageEntry>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

export async function accumulateAgentUsage(q: AsyncIterable<unknown>): Promise<AgentUsage> {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let costUsd = 0;
  let resultSubtype = 'unknown';
  let model: string | undefined;
  let modelOutputMax = -1;
  // 미로그인·토큰 만료는 subtype 'success' + is_error 로 옴 — 결과 텍스트를 잡아두지 않으면
  // SDK 가 빈 값을 던질 때 원인이 사라짐
  let errorResult: string | undefined;
  try {
    for await (const message of q) {
      const m = message as ResultMessage;
      if (m.type !== 'result') continue;
      if (m.is_error && typeof m.result === 'string' && m.result) errorResult = m.result;
      resultSubtype = m.subtype ?? 'unknown';
      if (typeof m.total_cost_usd === 'number') costUsd = m.total_cost_usd;
      if (m.modelUsage) {
        for (const [id, u] of Object.entries(m.modelUsage)) {
          inputTokens +=
            num(u.inputTokens) + num(u.cacheReadInputTokens) + num(u.cacheCreationInputTokens);
          cacheReadTokens += num(u.cacheReadInputTokens);
          cacheCreationTokens += num(u.cacheCreationInputTokens);
          outputTokens += num(u.outputTokens);
          // 여러 모델이 섞이면(오버로드 fallback 등) 출력을 가장 많이 낸 모델이 대표
          if (num(u.outputTokens) > modelOutputMax) {
            modelOutputMax = num(u.outputTokens);
            model = id;
          }
        }
      }
    }
  } catch (err) {
    if (errorResult && !(err instanceof Error && err.message)) {
      throw new Error(errorResult, { cause: err });
    }
    throw err;
  }
  if (errorResult) throw new Error(errorResult);
  return {
    resultSubtype,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
    ...(model ? { model } : {}),
  };
}
