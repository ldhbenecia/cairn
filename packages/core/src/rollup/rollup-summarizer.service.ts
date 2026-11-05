import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { customPromptFor, withCustomPrompt } from '../common/custom-prompt.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import { activityBlock } from '../common/submit-agent.js';
import { runSummaryAgent } from '../common/summary-run.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogLang } from '../cairn/run-options.js';
import { rollupSystemPrompt } from './rollup-prompt.js';
import {
  buildRollupActivityPayload,
  rollupSubmitSpec,
  dropForbiddenSummaries,
  type RollupSummarizerInput,
} from './rollup-tools.js';

@Injectable()
export class RollupSummarizerService {
  constructor(
    @InjectPinoLogger(RollupSummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: RollupSummarizerInput, lang: WorklogLang): Promise<RollupSummary | null> {
    const a = input.activity;

    this.logger.info({ period: a.period }, 'rollup summarizer start');

    // 활동을 프롬프트에 인라인 — 사용자가 편집한 daily 의 위반 항목은 날짜 단위로 drop 해 전체 실패 방지
    // 최종 전체 검사는 백스톱
    const safeSummaries = dropForbiddenSummaries(a.summaries, (date) =>
      this.logger.warn(
        { period: a.period, date },
        'rollup: daily summary dropped by egress check — excluded from rollup input',
      ),
    );
    const payload = buildRollupActivityPayload({
      activity: { ...a, summaries: safeSummaries },
    });
    assertNoForbiddenPayload(payload, 'summarizer.rollup-activity');
    const userPrompt = [
      `Summarize my work for the ${a.period} period ${a.rangeStart} ~ ${a.rangeEnd}.`,
      '',
      activityBlock(payload),
    ].join('\n');

    return runSummaryAgent(
      {
        ...rollupSubmitSpec,
        prompt: userPrompt,
        systemPrompt: withCustomPrompt(
          rollupSystemPrompt(lang, a.period),
          customPromptFor(a.period),
        ),
      },
      {
        logger: this.logger,
        label: 'rollup summarizer',
        ctx: { period: a.period },
        finishedCtx: { period: a.period, rangeStart: a.rangeStart, rangeEnd: a.rangeEnd },
      },
    );
  }
}
