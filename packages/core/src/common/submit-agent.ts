import { query, type McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { accumulateAgentUsage, type AgentUsage } from './agent-usage.js';
import { isolatedAgentOptions } from './agent-isolation.js';
import { claudeExecutableOptions } from './claude-executable.js';
import { CairnError } from './error.js';
import { summaryModelOption } from './summary-model.js';

export interface SubmitAgentRun<T> {
  usage: AgentUsage;
  submission: T | null;
  lateError: CairnError | null; // submission 도착 후 SDK 가 던진 에러 (결과는 사용)
}

const ERRORED_AFTER_SUBMIT: AgentUsage = {
  resultSubtype: 'errored_after_submit',
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0,
};

// 제출 도구 하나만 쓰는 요약 에이전트 실행 — 격리 옵션은 마지막에 펼쳐 호출부가 덮지 못함
// submission 없이 SDK 가 던지면 CairnError 로 rethrow
export async function runSubmitAgent<T>(args: {
  prompt: string;
  systemPrompt: string;
  server: McpSdkServerConfigWithInstance;
  toolName: string;
  getSubmission: () => T | null;
}): Promise<SubmitAgentRun<T>> {
  const { server, getSubmission } = args;
  try {
    const q = query({
      prompt: args.prompt,
      options: {
        systemPrompt: args.systemPrompt,
        mcpServers: { [server.name]: server },
        allowedTools: [`mcp__${server.name}__${args.toolName}`],
        // 요약은 추론 태스크가 아님 — 기본 effort('high')는 수천 thinking 토큰으로 수 분 걸림
        // maxTurns 는 자연 종료 캡 — 1·2 로 줄이면 SDK 가 error_max_turns 를 던져 도착한 submission 까지 버림
        effort: 'low',
        // effort 는 adaptive thinking 모델에만 작동하고 haiku 4.5 는 무시함 — 전 모델에서 끄려면 명시 disabled
        thinking: { type: 'disabled' },
        maxTurns: 3,
        ...summaryModelOption(),
        ...claudeExecutableOptions(),
        ...isolatedAgentOptions(),
      },
    });
    return { usage: await accumulateAgentUsage(q), submission: getSubmission(), lateError: null };
  } catch (err) {
    const error = CairnError.from(err, 'summarizer');
    // SDK 는 max-turns 등도 throw — submission 이 이미 도착했으면 유료 실행 결과를 버리지 않음
    const submission = getSubmission();
    if (!submission) throw error;
    return { usage: ERRORED_AFTER_SUBMIT, submission, lateError: error };
  }
}
