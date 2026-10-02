import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { accumulateAgentUsage, type AgentUsage } from '../common/agent-usage.js';
import { claudeExecutableOptions } from '../common/claude-executable.js';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { summaryModelOption } from '../common/summary-model.js';
import { CairnError } from '../common/error.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import { isOperator } from '../common/operator.js';
import type { WorklogSummary, WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { dailySystemPrompt } from './daily-prompt.js';
import {
  buildActivityPayload,
  buildSummarizerTools,
  type SummarizerInput,
} from './summarizer-tools.js';

const MCP_SERVER_NAME = 'cairn-summarizer';

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

    let agentUsage: AgentUsage;
    try {
      const q = query({
        prompt: userPrompt,
        options: {
          systemPrompt: withCustomPrompt(dailySystemPrompt(lang), customPromptFor('daily')),
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [`mcp__${MCP_SERVER_NAME}__submit_summary`],
          // 요약은 추론 태스크가 아님 — 기본 effort('high')는 수천 thinking 토큰으로 수 분 걸림
          // maxTurns 는 자연 종료 캡 — 1·2 로 줄이면 SDK 가 error_max_turns 를 던져 도착한 submission 까지 버림
          effort: 'low',
          // effort 는 adaptive thinking 모델에만 작동하고 haiku 4.5 는 무시함 — 전 모델에서 끄려면 명시 disabled
          thinking: { type: 'disabled' },
          maxTurns: 3,
          ...summaryModelOption(),
          ...claudeExecutableOptions(),
        },
      });
      agentUsage = await accumulateAgentUsage(q);
    } catch (err) {
      const error = CairnError.from(err, 'summarizer');
      // SDK 는 max-turns 등도 throw — submission 이 이미 도착했으면 유료 실행 결과를 버리지 않음
      if (getSubmission()) {
        this.logger.warn(
          { date: input.date, error },
          'summarizer threw after submission — using submitted result',
        );
        agentUsage = {
          resultSubtype: 'errored_after_submit',
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0,
        };
      } else {
        this.logger.warn({ date: input.date, error }, 'summarizer threw — fallback');
        return null;
      }
    }
    const {
      resultSubtype,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      costUsd,
      model,
    } = agentUsage;

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

    const submission = getSubmission();
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
