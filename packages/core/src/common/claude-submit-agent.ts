import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import type { z } from 'zod';
import { accumulateAgentUsage, type AgentUsage } from './agent-usage.js';
import { isolatedAgentOptions } from './agent-isolation.js';
import { claudeExecutableOptions } from './claude-executable.js';
import { CairnError } from './error.js';
import { summaryModelOption } from './summary-model.js';
import type { SubmitAgentRun, SubmitTask } from './submit-agent.js';

const ERRORED_AFTER_SUBMIT: AgentUsage = {
  resultSubtype: 'errored_after_submit',
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0,
};

// 제출 도구 하나만 쓰는 요약 에이전트 실행 — 격리 옵션은 마지막에 펼쳐 호출부가 덮지 못함
export async function runClaudeSubmitAgent<S extends z.ZodObject>(
  task: SubmitTask<S>,
): Promise<SubmitAgentRun<z.output<S>>> {
  let submission: z.output<S> | null = null;
  const getSubmission = (): z.output<S> | null => submission;
  const server = createSdkMcpServer({
    name: task.serverName,
    tools: [
      tool(
        task.toolName,
        task.toolDescription,
        task.schema.shape,
        // eslint-disable-next-line @typescript-eslint/require-await
        async (raw) => {
          submission = task.schema.parse(raw);
          return { content: [{ type: 'text', text: 'Submitted. Exiting.' }] };
        },
      ),
    ],
    alwaysLoad: true, // tools: [] 로 ToolSearch 가 꺼져 지연 로딩되면 제출 도구를 못 부름
  });

  try {
    const q = query({
      prompt: task.prompt,
      options: {
        systemPrompt: task.systemPrompt,
        mcpServers: { [server.name]: server },
        allowedTools: [`mcp__${server.name}__${task.toolName}`],
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
    const arrived = getSubmission();
    if (!arrived) throw error;
    return { usage: ERRORED_AFTER_SUBMIT, submission: arrived, lateError: error };
  }
}
