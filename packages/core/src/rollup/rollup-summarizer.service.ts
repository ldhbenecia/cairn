import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { claudeExecutableOptions } from '../common/claude-executable.js';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { buildRollupTools, type RollupSummarizerInput } from './rollup-tools.js';

function systemPrompt(lang: WorklogLang, period: 'weekly' | 'monthly'): string {
  const langName = lang === 'en' ? 'English' : 'Korean';
  const periodFocus =
    period === 'weekly'
      ? 'Weekly focus: an operational digest. Show what moved this week per project — concrete work units shipped and progress on in-flight efforts. Keep enough detail that the month-end rollup can be built from these.'
      : 'Monthly focus: an achievement record. Phrase highlights as resume-ready accomplishment statements — scope, scale, and impact first. Aggregate small fixes into initiative-level items; a month should read as a list of accomplishments, not chores.';
  return [
    'You are a rollup summarizer for a developer.',
    "Purpose: the rollup accumulates over months/years as raw material for the developer's resume, performance/salary reviews, and retrospectives. Phrase highlights/themes to stay meaningful months later — project, the meaningful work unit, outcome.",
    periodFocus,
    '',
    'Workflow: call get_rollup_activity exactly once (per-day summaries already produced), then call submit_rollup exactly once.',
    '',
    `Output language MUST be ${langName}.`,
    '- paragraphKo: 2-5 short sentences capturing the period theme at project level — overall direction + which projects/initiatives moved. Open with the period totals from metrics (PR count, commit count, active days out of the range).',
    '- themes: 2-6 themed groupings, each with a title and 2-8 items (phrases of work under it). Group by project/initiative, not by date.',
    '- highlights: 3-8 phrases of the most resume/retrospective-worthy items across the period, format "[project] meaningful work unit — outcome/scale".',
    '- reviewedBullets in older daily summaries are review/support work — exclude them from themes/highlights; only development work belongs in the rollup.',
    '- Empty arrays are OK if material is thin.',
    '',
    'Quantify: weave the provided metrics into paragraphKo, and carry concrete numbers from the daily summaries (counts, %, ms, sizes, before→after) into themes and highlights. NEVER invent or estimate numbers that are not present in the data.',
    '',
    'Style: synthesize across days (do NOT concatenate per-day bullets verbatim); no branch names or commit type prefixes; group by project and meaningful unit, not by date.',
    '',
    'Do not invent items — only summarize what get_rollup_activity returned. No code bodies, diffs, absolute paths, or tokens. If sourceError is present, mention the limitation briefly in paragraphKo.',
  ].join('\n');
}

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

    const userPrompt = `Summarize my work for the ${a.period} period ${a.rangeStart} ~ ${a.rangeEnd}. Call get_rollup_activity, then submit_rollup.`;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let resultSubtype = 'unknown';

    try {
      const q = query({
        prompt: userPrompt,
        options: {
          systemPrompt: withCustomPrompt(systemPrompt(lang, a.period), customPromptFor(a.period)),
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [
            `mcp__${MCP_SERVER_NAME}__get_rollup_activity`,
            `mcp__${MCP_SERVER_NAME}__submit_rollup`,
          ],
          maxTurns: 10,
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
