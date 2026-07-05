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

    // 데스크톱 단계 표시가 이 라인으로 collect → summarize 전환을 감지한다 (core-runner STEP_TRIGGERS)
    this.logger.info({ date: input.date }, 'summarizer start');

    // 활동을 프롬프트에 인라인 — get_activity 도구 왕복 제거 (모델 턴 1회 단축).
    // 동일 payload 를 동일 검사로 통과시키므로 외부 송신 내용은 불변 (ADR 0003/0021)
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
          maxTurns: 3,
          ...summaryModelOption(),
          ...claudeExecutableOptions(),
        },
      });
      agentUsage = await accumulateAgentUsage(q);
    } catch (err) {
      const error = CairnError.from(err, 'summarizer');
      this.logger.warn({ date: input.date, error }, 'summarizer threw — fallback');
      return null;
    }
    const { resultSubtype, inputTokens, outputTokens, costUsd, model } = agentUsage;

    this.logger.info(
      {
        date: input.date,
        resultSubtype,
        inputTokens,
        outputTokens,
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
      // submit_summary 는 이미 도착 — maxTurns 등 비정상 종료여도 유료 실행 결과를 버리지 않는다
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
