import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { accumulateAgentUsage, type AgentUsage } from '../common/agent-usage.js';
import { claudeExecutableOptions } from '../common/claude-executable.js';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { CairnError } from '../common/error.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import { isOperator } from '../common/operator.js';
import { summaryModelOption } from '../common/summary-model.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { rollupSystemPrompt } from './rollup-prompt.js';
import {
  buildRollupActivityPayload,
  buildRollupTools,
  type RollupSummarizerInput,
} from './rollup-tools.js';

const MCP_SERVER_NAME = 'cairn-rollup';

@Injectable()
export class RollupSummarizerService {
  constructor(
    @InjectPinoLogger(RollupSummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: RollupSummarizerInput, lang: WorklogLang): Promise<RollupSummary | null> {
    const { server, getSubmission } = buildRollupTools();
    const a = input.activity;

    // 데스크톱 단계 표시가 이 라인으로 collect → summarize 전환을 감지한다 (core-runner STEP_TRIGGERS)
    this.logger.info({ period: a.period }, 'rollup summarizer start');

    // 활동을 프롬프트에 인라인 — 도구 왕복 제거, egress 검사는 동일 (ADR 0003/0021)
    const payload = buildRollupActivityPayload(input);
    assertNoForbiddenPayload(payload, 'summarizer.rollup-activity');
    const userPrompt = [
      `Summarize my work for the ${a.period} period ${a.rangeStart} ~ ${a.rangeEnd}.`,
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
          systemPrompt: withCustomPrompt(
            rollupSystemPrompt(lang, a.period),
            customPromptFor(a.period),
          ),
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [`mcp__${MCP_SERVER_NAME}__submit_rollup`],
          maxTurns: 3,
          ...summaryModelOption(),
          ...claudeExecutableOptions(),
        },
      });
      agentUsage = await accumulateAgentUsage(q);
    } catch (err) {
      const error = CairnError.from(err, 'summarizer');
      this.logger.warn({ period: a.period, error }, 'rollup summarizer threw — fallback');
      return null;
    }
    const { resultSubtype, inputTokens, outputTokens, costUsd } = agentUsage;

    this.logger.info(
      {
        period: a.period,
        rangeStart: a.rangeStart,
        rangeEnd: a.rangeEnd,
        resultSubtype,
        inputTokens,
        outputTokens,
        costUsd,
        isOperator: isOperator(),
      },
      'rollup summarizer finished',
    );

    if (resultSubtype !== 'success') {
      this.logger.warn(
        { period: a.period, resultSubtype },
        'rollup summarizer non-success — fallback',
      );
      return null;
    }

    const submission = getSubmission();
    if (!submission) {
      this.logger.warn(
        { period: a.period },
        'rollup summarizer ended without submit_rollup — fallback',
      );
      return null;
    }

    const usage: WorklogSummaryUsage | undefined = isOperator()
      ? { inputTokens, outputTokens, costUsd }
      : undefined;

    return { ...submission, ...(usage ? { usage } : {}) };
  }
}
