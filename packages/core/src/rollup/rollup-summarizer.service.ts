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
  dropForbiddenSummaries,
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
    // 사용자가 편집한 daily 페이지의 위반 항목은 날짜 단위로 drop (전체 실패 방지), 최종 전체 검사는 백스톱
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
          // 요약은 추론 태스크가 아니다 — 기본 effort('high')가 8~10K thinking 토큰을 태워
          // 요약이 1.5~2분 걸리던 실측 원인. maxTurns 는 자연 종료 캡(성능 무관 — 1·2 로 줄이면
          // SDK 가 error_max_turns 를 throw 해 이미 도착한 submission 까지 버린다, 실측)
          effort: 'low',
          // effort 는 adaptive thinking 모델(sonnet 5 등)에만 작동 — haiku 4.5 는 무시하고
          // thinking 을 계속 태워 102초/9.5K 출력(실측). 전 모델에서 확실히 끄려면 명시 disabled
          thinking: { type: 'disabled' },
          maxTurns: 3,
          ...summaryModelOption(),
          ...claudeExecutableOptions(),
        },
      });
      agentUsage = await accumulateAgentUsage(q);
    } catch (err) {
      const error = CairnError.from(err, 'summarizer');
      // SDK 는 max-turns 등도 throw 한다 — submission 이 이미 도착했으면 유료 실행 결과를 버리지 않는다
      if (getSubmission()) {
        this.logger.warn(
          { period: a.period, error },
          'rollup summarizer threw after submission — using submitted result',
        );
        agentUsage = {
          resultSubtype: 'errored_after_submit',
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0,
        };
      } else {
        this.logger.warn({ period: a.period, error }, 'rollup summarizer threw — fallback');
        return null;
      }
    }
    const {
      resultSubtype,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      costUsd,
      model,
    } = agentUsage;

    this.logger.info(
      {
        period: a.period,
        rangeStart: a.rangeStart,
        rangeEnd: a.rangeEnd,
        resultSubtype,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd,
        isOperator: isOperator(),
      },
      'rollup summarizer finished',
    );

    const submission = getSubmission();
    if (!submission) {
      this.logger.warn(
        { period: a.period, resultSubtype },
        'rollup summarizer ended without submit_rollup — fallback',
      );
      return null;
    }
    if (resultSubtype !== 'success') {
      // submit_rollup 은 이미 도착 — maxTurns 등 비정상 종료여도 유료 실행 결과를 버리지 않는다 (daily 와 동일)
      this.logger.warn(
        { period: a.period, resultSubtype },
        'rollup summarizer non-success but submission present — using it',
      );
    }

    const usage: WorklogSummaryUsage | undefined = isOperator()
      ? { inputTokens, outputTokens, costUsd, ...(model ? { model } : {}) }
      : undefined;

    return { ...submission, ...(usage ? { usage } : {}) };
  }
}
