import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import { activityBlock } from '../common/submit-agent.js';
import { runSummaryAgent } from '../common/summary-run.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { dailySystemPrompt } from './daily-prompt.js';
import {
  buildActivityPayload,
  summarySubmitSpec,
  type SummarizerInput,
} from './summarizer-tools.js';

@Injectable()
export class DailySummarizerService {
  constructor(
    @InjectPinoLogger(DailySummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: SummarizerInput, lang: WorklogLang): Promise<WorklogSummary | null> {
    this.logger.info({ date: input.date }, 'summarizer start');

    // 활동을 프롬프트에 인라인해 get_activity 도구 왕복(모델 턴 1회) 제거
    // 같은 payload 가 같은 검사를 통과하므로 외부 송신 내용은 불변
    const payload = buildActivityPayload(input);
    assertNoForbiddenPayload(payload, 'summarizer.activity');
    const userPrompt = [`Summarize my work for ${input.date}.`, '', activityBlock(payload)].join(
      '\n',
    );

    return runSummaryAgent(
      {
        ...summarySubmitSpec,
        prompt: userPrompt,
        systemPrompt: withCustomPrompt(dailySystemPrompt(lang), customPromptFor('daily')),
      },
      { logger: this.logger, label: 'summarizer', ctx: { date: input.date } },
    );
  }
}
