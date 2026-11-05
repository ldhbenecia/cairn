import type { z } from 'zod';
import type { AgentUsage } from './agent-usage.js';
import { runClaudeSubmitAgent } from './claude-submit-agent.js';
import type { CairnError } from './error.js';

// 결과를 받을 제출 명세 — provider 가 스키마로 도구·출력 형식을 만들고 결과는 항상 schema.parse 를 거침
export interface SubmitSpec<S extends z.ZodObject> {
  serverName: string;
  toolName: string;
  toolDescription: string;
  schema: S;
}

export interface SubmitTask<S extends z.ZodObject> extends SubmitSpec<S> {
  prompt: string;
  systemPrompt: string;
}

export interface SubmitAgentRun<T> {
  usage: AgentUsage;
  submission: T | null;
  lateError: CairnError | null; // submission 도착 후 SDK 가 던진 에러 (결과는 사용)
}

// submission 없이 실패하면 CairnError 로 throw
export function runSubmitAgent<S extends z.ZodObject>(
  task: SubmitTask<S>,
): Promise<SubmitAgentRun<z.output<S>>> {
  return runClaudeSubmitAgent(task);
}
