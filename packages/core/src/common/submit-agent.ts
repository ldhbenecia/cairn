import type { z } from 'zod';
import type { AgentUsage } from './agent-usage.js';
import { runClaudeSubmitAgent } from './claude-submit-agent.js';
import { runCodexSubmitAgent } from './codex-submit-agent.js';
import type { CairnError } from './error.js';
import { summaryProvider } from './summary-provider.js';

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
export async function runSubmitAgent<S extends z.ZodObject>(
  task: SubmitTask<S>,
): Promise<SubmitAgentRun<z.output<S>>> {
  const run =
    summaryProvider() === 'codex'
      ? await runCodexSubmitAgent(task)
      : await runClaudeSubmitAgent(task);
  return { ...run, submission: run.submission && neutralizeMarkdown(run.submission) };
}

// 활동 JSON 을 프롬프트에 인라인 — '<' 를 이스케이프해 PR 본문 속 '</activity>' 로 데이터 영역을 빠져나가지 못하게 함 (JSON 으로는 동일)
export function activityBlock(payload: unknown): string {
  return ['<activity>', JSON.stringify(payload).replace(/</g, '\\u003c'), '</activity>'].join('\n');
}

// 모델 출력은 일지 .md 로 저장돼 Obsidian·GitHub 에서 렌더됨 — 입력에 심은 지시로 이미지·링크 URL 에 활동을 실어 보내지 못하게
// 링크는 텍스트만 남기고 이미지 표식·HTML 태그는 제거, '[repo]' 같은 대괄호는 유지
export function neutralizeMarkdown<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/!\[/g, '[')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '') as T;
  }
  if (Array.isArray(value)) return value.map((v: unknown) => neutralizeMarkdown(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, neutralizeMarkdown(v)]),
    ) as T;
  }
  return value;
}
