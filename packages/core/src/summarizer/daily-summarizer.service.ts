import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import type { WorklogSummary, WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { buildSummarizerTools, type SummarizerInput } from './summarizer-tools.js';

function systemPrompt(lang: WorklogLang): string {
  const langName = lang === 'en' ? 'English' : 'Korean';
  return [
    'You are a worklog summarizer for a developer.',
    "Purpose: the worklog accumulates over months/years as raw material for the developer's resume, reviews, and retrospectives. Phrase bullets to stay meaningful months later — project, the meaningful work unit, outcome.",
    '',
    'Workflow: call get_activity exactly once, then call submit_summary exactly once.',
    '',
    `Output language MUST be ${langName}.`,
    '- paragraphKo: 1-3 short sentences capturing the day theme at the project level — overall direction and the most notable outcome.',
    '- doneBullets: 3-10 phrases, format "[project] meaningful work unit — outcome". project = repo name. Group related commits/PRs of the same repo into one bullet. Emphasize OUTCOMES and impact (what shipped, what improved, performance/metrics, before→after, scope) over listing commits. Mine PR.body for the "why" and results; use commitsOnDate keywords for specifics. Avoid over-abstraction and avoid mere commit enumeration.',
    '- inProgressBullets: same format, ongoing work.',
    '- notesBullets: misc notes or highlights, only when relevant (usually empty).',
    '- Empty arrays are OK.',
    '',
    'Style: synthesize — do NOT copy commit subjects verbatim; no branch names or type prefixes like "feat(scope):"; combine related commits into a single bullet; short noun/verb-noun phrases, not full sentences.',
    '',
    'Do not invent items — only summarize what get_activity returned. No code bodies, diffs, absolute paths, or tokens. If sourceErrors are present, mention them briefly in paragraphKo.',
  ].join('\n');
}

const MCP_SERVER_NAME = 'cairn-summarizer';

@Injectable()
export class DailySummarizerService {
  constructor(
    @InjectPinoLogger(DailySummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: SummarizerInput, lang: WorklogLang): Promise<WorklogSummary | null> {
    const { server, getSubmission } = buildSummarizerTools(input);

    const userPrompt = `Summarize my work for ${input.date}.`;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let resultSubtype = 'unknown';

    try {
      const q = query({
        prompt: userPrompt,
        options: {
          systemPrompt: systemPrompt(lang),
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [
            `mcp__${MCP_SERVER_NAME}__get_activity`,
            `mcp__${MCP_SERVER_NAME}__submit_summary`,
          ],
          maxTurns: 5,
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
      this.logger.warn({ date: input.date, error }, 'summarizer threw — fallback');
      return null;
    }

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

    if (resultSubtype !== 'success') {
      this.logger.warn({ date: input.date, resultSubtype }, 'summarizer non-success — fallback');
      return null;
    }

    const submission = getSubmission();
    if (!submission) {
      this.logger.warn({ date: input.date }, 'summarizer ended without submit_summary — fallback');
      return null;
    }

    const usage: WorklogSummaryUsage | undefined = isOperator()
      ? { inputTokens, outputTokens, costUsd }
      : undefined;

    return { ...submission, ...(usage ? { usage } : {}) };
  }
}
