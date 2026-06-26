import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { accumulateAgentUsage, type AgentUsage } from '../common/agent-usage.js';
import { claudeExecutableOptions } from '../common/claude-executable.js';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { summaryModelOption } from '../common/summary-model.js';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import type { WorklogSummary, WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { dailySystemPrompt } from './daily-prompt.js';
import { buildSummarizerTools, type SummarizerInput } from './summarizer-tools.js';

const MCP_SERVER_NAME = 'cairn-summarizer';

@Injectable()
export class DailySummarizerService {
  constructor(
    @InjectPinoLogger(DailySummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: SummarizerInput, lang: WorklogLang): Promise<WorklogSummary | null> {
    const { server, getSubmission } = buildSummarizerTools(input);

    // 데스크톱 단계 표시가 이 라인으로 collect → summarize 전환을 감지한다 (core-runner STEP_TRIGGERS)
    this.logger.info({ date: input.date }, 'summarizer start');

    const userPrompt = `Summarize my work for ${input.date}.`;

    let agentUsage: AgentUsage;
    try {
      const q = query({
        prompt: userPrompt,
        options: {
          systemPrompt: withCustomPrompt(dailySystemPrompt(lang), customPromptFor('daily')),
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [
            `mcp__${MCP_SERVER_NAME}__get_activity`,
            `mcp__${MCP_SERVER_NAME}__submit_summary`,
          ],
          maxTurns: 5,
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
    const { resultSubtype, inputTokens, outputTokens, costUsd } = agentUsage;

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
