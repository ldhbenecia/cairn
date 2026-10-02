import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import { runSubmitAgent, type SubmitAgentRun } from '../common/submit-agent.js';
import { isOperator } from '../common/operator.js';
import type { WorklogSummary, WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { dailySystemPrompt } from './daily-prompt.js';
import {
  buildActivityPayload,
  buildSummarizerTools,
  type SubmitSummaryInput,
  type SummarizerInput,
} from './summarizer-tools.js';

@Injectable()
export class DailySummarizerService {
  constructor(
    @InjectPinoLogger(DailySummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: SummarizerInput, lang: WorklogLang): Promise<WorklogSummary | null> {
    const { server, getSubmission } = buildSummarizerTools();

    // 데스크톱 단계 표시가 이 라인으로 collect → summarize 전환을 감지 (core-runner STEP_TRIGGERS)
    this.logger.info({ date: input.date }, 'summarizer start');

    // 활동을 프롬프트에 인라인해 get_activity 도구 왕복(모델 턴 1회) 제거
    // 같은 payload 가 같은 검사를 통과하므로 외부 송신 내용은 불변
    const payload = buildActivityPayload(input);
    assertNoForbiddenPayload(payload, 'summarizer.activity');
    const userPrompt = [
      `Summarize my work for ${input.date}.`,
      '',
      '<activity>',
      JSON.stringify(payload),
      '</activity>',
    ].join('\n');

    let run: SubmitAgentRun<SubmitSummaryInput>;
    try {
      run = await runSubmitAgent({
        prompt: userPrompt,
        systemPrompt: withCustomPrompt(dailySystemPrompt(lang), customPromptFor('daily')),
        server,
        toolName: 'submit_summary',
        getSubmission,
      });
    } catch (error) {
      this.logger.warn({ date: input.date, error }, 'summarizer threw — fallback');
      return null;
    }
    if (run.lateError) {
      this.logger.warn(
        { date: input.date, error: run.lateError },
        'summarizer threw after submission — using submitted result',
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

    this.logger.info(
      {
        date: input.date,
        resultSubtype,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd,
        isOperator: isOperator(),
      },
      'summarizer finished',
    );

    const { submission } = run;
    if (!submission) {
      this.logger.warn(
        { date: input.date, resultSubtype },
        'summarizer ended without submit_summary — fallback',
      );
      return null;
    }
    if (resultSubtype !== 'success') {
      // submit_summary 는 이미 도착 — maxTurns 등 비정상 종료여도 유료 실행 결과 사용
      this.logger.warn(
        { date: input.date, resultSubtype },
        'summarizer non-success but submission present — using it',
      );
    }

    const usage: WorklogSummaryUsage | undefined = isOperator()
      ? { inputTokens, outputTokens, costUsd, ...(model ? { model } : {}) }
      : undefined;

    return { ...submission, ...(usage ? { usage } : {}) };
  }
}
