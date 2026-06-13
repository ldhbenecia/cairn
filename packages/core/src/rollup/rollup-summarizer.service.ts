import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { claudeExecutableOptions } from '../common/claude-executable.js';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import { summaryModelOption } from '../common/summary-model.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { rollupSystemPrompt } from './rollup-prompt.js';
import { buildRollupTools, type RollupSummarizerInput } from './rollup-tools.js';

const MCP_SERVER_NAME = 'cairn-rollup';

@Injectable()
export class RollupSummarizerService {
  constructor(
    @InjectPinoLogger(RollupSummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: RollupSummarizerInput, lang: WorklogLang): Promise<RollupSummary | null> {
    const { server, getSubmission } = buildRollupTools(input);
    const a = input.activity;

    // 데스크톱 단계 표시가 이 라인으로 collect → summarize 전환을 감지한다 (core-runner STEP_TRIGGERS)
    this.logger.info({ period: a.period }, 'rollup summarizer start');

    const userPrompt = `Summarize my work for the ${a.period} period ${a.rangeStart} ~ ${a.rangeEnd}. Call get_rollup_activity, then submit_rollup.`;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let resultSubtype = 'unknown';

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
          allowedTools: [
            `mcp__${MCP_SERVER_NAME}__get_rollup_activity`,
            `mcp__${MCP_SERVER_NAME}__submit_rollup`,
          ],
          maxTurns: 10,
          ...summaryModelOption(),
          ...claudeExecutableOptions(),
        },
      });

      for await (const message of q) {
        if (message.type === 'result') {
          resultSubtype = message.subtype;
          if ('total_cost_usd' in message && typeof message.total_cost_usd === 'number') {
            costUsd = message.total_cost_usd;
          }
          const modelUsage = (
            message as {
              modelUsage?: Record<
                string,
                {
                  inputTokens?: number;
                  outputTokens?: number;
                  cacheReadInputTokens?: number;
                  cacheCreationInputTokens?: number;
                }
              >;
            }
          ).modelUsage;
          if (modelUsage) {
            for (const u of Object.values(modelUsage)) {
              inputTokens +=
                (typeof u.inputTokens === 'number' ? u.inputTokens : 0) +
                (typeof u.cacheReadInputTokens === 'number' ? u.cacheReadInputTokens : 0) +
                (typeof u.cacheCreationInputTokens === 'number' ? u.cacheCreationInputTokens : 0);
              outputTokens += typeof u.outputTokens === 'number' ? u.outputTokens : 0;
            }
          }
        }
      }
    } catch (err) {
      const error = CairnError.from(err, 'summarizer');
      this.logger.warn({ period: a.period, error }, 'rollup summarizer threw — fallback');
      return null;
    }

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
