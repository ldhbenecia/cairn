import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import type { WorklogSummary, WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import { buildSummarizerTools, type SummarizerInput } from './summarizer-tools.js';

const SYSTEM_PROMPT = [
  'You are cairn, a Korean worklog summarizer for a backend developer.',
  '',
  'Workflow:',
  "1. Call get_activity exactly once to retrieve today's data.",
  '2. Read the response (done / inProgress / notes / sourceErrors).',
  '3. Call submit_summary exactly once with a Korean summary.',
  '',
  'Rules:',
  '- Output language MUST be Korean. paragraphKo and every bullet are Korean.',
  '- paragraphKo: 1-3 short Korean sentences summarizing the day overall.',
  '- doneBullets: completed items (merged PRs, pushed commits). One line per bullet.',
  '- inProgressBullets: ongoing items (open PRs, unpushed commits, active branches).',
  '- notesBullets: Notion pages edited today (one line per page with short context).',
  '- Empty arrays are OK if no items in that category.',
  '- Do not invent items. Only summarize what get_activity returned.',
  '- Do not include code bodies, diffs, or absolute file paths.',
  '- If sourceErrors are present, briefly mention them in paragraphKo.',
].join('\n');

const MCP_SERVER_NAME = 'cairn-summarizer';

@Injectable()
export class DailySummarizerService {
  constructor(
    @InjectPinoLogger(DailySummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: SummarizerInput): Promise<WorklogSummary | null> {
    const { server, getSubmission } = buildSummarizerTools(input);

    const userPrompt = `Summarize my work for ${input.date} (KST). Call get_activity, then submit_summary.`;

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
          if ('usage' in message && message.usage && typeof message.usage === 'object') {
            const u = message.usage as { input_tokens?: number; output_tokens?: number };
            inputTokens = typeof u.input_tokens === 'number' ? u.input_tokens : 0;
            outputTokens = typeof u.output_tokens === 'number' ? u.output_tokens : 0;
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
