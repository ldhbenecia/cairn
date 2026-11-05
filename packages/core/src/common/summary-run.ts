import type { PinoLogger } from 'nestjs-pino';
import type { z } from 'zod';
import type { WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import { isOperator } from './operator.js';
import { runSubmitAgent, type SubmitAgentRun, type SubmitTask } from './submit-agent.js';

// 요약 실행 결과 정책 — 실패는 null(호출부가 폴백), 제출이 도착했으면 비정상 종료여도 유료 실행 결과 사용
// label 이 들어간 'summarizer finished' 로그는 데스크톱 단계 표시가 매칭함
export async function runSummaryAgent<S extends z.ZodObject>(
  task: SubmitTask<S>,
  log: {
    logger: PinoLogger;
    label: string;
    ctx: Record<string, unknown>;
    finishedCtx?: Record<string, unknown>;
  },
): Promise<(z.output<S> & { usage?: WorklogSummaryUsage }) | null> {
  const { logger, label, ctx } = log;
  let run: SubmitAgentRun<z.output<S>>;
  try {
    run = await runSubmitAgent(task);
  } catch (error) {
    logger.warn({ ...ctx, error }, `${label} threw — fallback`);
    return null;
  }
  if (run.lateError) {
    logger.warn(
      { ...ctx, error: run.lateError },
      `${label} threw after submission — using submitted result`,
    );
  }
  const {
    resultSubtype,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
    model,
  } = run.usage;
  logger.info(
    {
      ...(log.finishedCtx ?? ctx),
      resultSubtype,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      costUsd,
      isOperator: isOperator(),
    },
    `${label} finished`,
  );

  const { submission } = run;
  if (!submission) {
    logger.warn({ ...ctx, resultSubtype }, `${label} ended without ${task.toolName} — fallback`);
    return null;
  }
  if (resultSubtype !== 'success') {
    logger.warn(
      { ...ctx, resultSubtype },
      `${label} non-success but submission present — using it`,
    );
  }
  const usage: WorklogSummaryUsage | undefined = isOperator()
    ? { inputTokens, outputTokens, costUsd, ...(model ? { model } : {}) }
    : undefined;
  return { ...submission, ...(usage ? { usage } : {}) };
}
