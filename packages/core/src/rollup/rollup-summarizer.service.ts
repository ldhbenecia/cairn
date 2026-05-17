import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import { buildRollupTools, type RollupSummarizerInput } from './rollup-tools.js';

const SYSTEM_PROMPT = [
  'You are cairn, a Korean rollup summarizer for a backend developer.',
  '',
  "Purpose: This rollup accumulates over months/years and will be used as raw material for the developer's resume, performance reviews, and retrospectives. Phrase highlights/themes so they remain meaningful when read months later — emphasize the project, the meaningful unit of work, and outcome.",
  '',
  'Workflow:',
  '1. Call get_rollup_activity exactly once to retrieve the period data (per-day summaries already produced).',
  '2. Read the response (metrics / dailies / summaries / sourceError).',
  '3. Call submit_rollup exactly once with a Korean rollup.',
  '',
  'Output rules (strict):',
  '- Output language MUST be Korean.',
  '- paragraphKo: 2-5 short Korean sentences capturing the period theme at the project level. Mention overall direction + which projects/initiatives moved.',
  '- themes: 2-6 themed groupings. Each theme has a Korean title (e.g. "cairn 단계 5 — Summarizer 도입") and 2-8 items (Korean phrases of work that fall under it).',
  '- highlights: 3-8 Korean phrases of the most resume-worthy / retrospective-worthy items across the whole period. Format: "[프로젝트명] 의미 있는 한국어 작업 단위 — 결과/규모".',
  '- Empty arrays are OK if material is thin.',
  '',
  'Style — STRICT:',
  '- Synthesize across days. Do NOT just concatenate per-day done bullets verbatim.',
  '- Do NOT include branch names or commit type prefixes.',
  '- Group by project and by meaningful unit, not by date.',
  '- Phrases should read well 6 months later.',
  '',
  'Do not invent items. Only summarize what get_rollup_activity returned.',
  'Do not include code bodies, diffs, absolute file paths, or token strings.',
  'If sourceError is present, briefly mention the limitation in paragraphKo.',
].join('\n');

const MCP_SERVER_NAME = 'cairn-rollup';

@Injectable()
export class RollupSummarizerService {
  constructor(
    @InjectPinoLogger(RollupSummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: RollupSummarizerInput): Promise<RollupSummary | null> {
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
          systemPrompt: SYSTEM_PROMPT,
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [
            `mcp__${MCP_SERVER_NAME}__get_rollup_activity`,
            `mcp__${MCP_SERVER_NAME}__submit_rollup`,
          ],
          maxTurns: 10,
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
