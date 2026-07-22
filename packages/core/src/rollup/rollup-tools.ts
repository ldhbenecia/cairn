import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { assertNoForbiddenPayload, sanitizeCairnError } from '../common/sanitize.js';
import type { RollupActivity, RollupDailySummaryText } from '../contracts/rollup-activity.types.js';

export interface RollupSummarizerInput {
  activity: RollupActivity;
}

// highlights 파싱 계약: 모든 항목은 "[project]" 또는 "[label] [project]" 대괄호 프리픽스로 시작해야
// downstream 프로젝트 매핑이 깨지지 않는다 (daily done 불릿과 동일 계약). 미충족 시 검증 실패 → 재생성 유도
const HIGHLIGHT_PREFIX = /^\[[^\]]+\]\s*(?:\[[^\]]+\]\s*)?\S/;

export const submitRollupSchema = z.object({
  // Notion rich_text text.content 한도가 2000자 — 2500 이면 스키마는 통과하고 발행이 터진다
  paragraph: z.string().min(1).max(2000),
  themes: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        items: z.array(z.string().min(1).max(300)).max(20),
      }),
    )
    .max(10),
  highlights: z
    .array(
      z
        .string()
        .min(1)
        .max(300)
        .refine((s) => HIGHLIGHT_PREFIX.test(s), {
          message: 'each highlight must start with a "[project]" (or "[label] [project]") prefix',
        }),
    )
    .max(10),
  // 분석 코멘터리(선택) — 전 기간 대비·정체 항목. 근거 데이터 없으면 생략
  commentary: z.string().min(1).max(2000).optional(),
});

export type SubmitRollupInput = z.infer<typeof submitRollupSchema>;

interface RollupActivityPayload {
  period: 'weekly' | 'monthly' | 'yearly';
  rangeStart: string;
  rangeEnd: string;
  previous?: {
    rangeStart: string;
    rangeEnd: string;
    prCount: number;
    commitCount: number;
    paragraph: string | null;
  };
  metrics: {
    prCount: number;
    commitCount: number;
    dailyCount: number;
  };
  dailies: ReadonlyArray<{
    date: string;
    url: string;
    prCount: number;
    commitCount: number;
  }>;
  summaries: ReadonlyArray<{
    date: string;
    paragraph: string;
    doneBullets: readonly string[];
    reviewedBullets: readonly string[];
    inProgressBullets: readonly string[];
    notesBullets: readonly string[];
  }>;
  sourceError?: ReturnType<typeof sanitizeCairnError>;
}

export function buildRollupActivityPayload(input: RollupSummarizerInput): RollupActivityPayload {
  const a = input.activity;
  const payload: RollupActivityPayload = {
    period: a.period,
    rangeStart: a.rangeStart,
    rangeEnd: a.rangeEnd,
    ...(a.previous ? { previous: a.previous } : {}),
    metrics: a.metrics,
    dailies: a.dailies.map((d) => ({
      date: d.date,
      url: d.url,
      prCount: d.prCount,
      commitCount: d.commitCount,
    })),
    summaries: a.summaries.map((s) => ({
      date: s.date,
      paragraph: s.paragraph,
      doneBullets: s.doneBullets,
      reviewedBullets: s.reviewedBullets,
      inProgressBullets: s.inProgressBullets,
      notesBullets: s.notesBullets,
    })),
  };
  if (a.error) payload.sourceError = sanitizeCairnError(a.error);
  return payload;
}

// daily 페이지는 발행 후 사용자가 자유 편집하는 대상 — 어느 날의 bullet 하나에 금지 패턴
// (이메일·절대경로 등)이 들어가면 전체-payload fail-closed 가 롤업을 결정적·영구적으로
// 실패시키던 문제. 항목(날짜) 단위로 검사해 위반 항목만 drop 한다 (ADR 0021 item-drop)
export function dropForbiddenSummaries(
  summaries: readonly RollupDailySummaryText[],
  onDrop: (date: string) => void,
): RollupDailySummaryText[] {
  const safe: RollupDailySummaryText[] = [];
  for (const s of summaries) {
    try {
      assertNoForbiddenPayload(s, `summarizer.rollup-daily.${s.date}`);
      safe.push(s);
    } catch {
      onDrop(s.date);
    }
  }
  return safe;
}

export interface RollupToolsBundle {
  server: ReturnType<typeof createSdkMcpServer>;
  getSubmission: () => SubmitRollupInput | null;
}

// 활동 데이터는 user 프롬프트에 인라인 — get_rollup_activity 도구 왕복 제거 (daily 와 동일 근거)
export function buildRollupTools(): RollupToolsBundle {
  let submission: SubmitRollupInput | null = null;

  const submitRollup = tool(
    'submit_rollup',
    'Submit the rollup summary and exit. Call exactly once after reading the period activity data in the user message. paragraph + themes + highlights MUST use the output language set in the system prompt.',
    submitRollupSchema.shape,
    // eslint-disable-next-line @typescript-eslint/require-await
    async (raw) => {
      submission = submitRollupSchema.parse(raw);
      return { content: [{ type: 'text', text: 'Rollup submitted. Exiting.' }] };
    },
  );

  const server = createSdkMcpServer({
    name: 'cairn-rollup',
    tools: [submitRollup],
  });

  return {
    server,
    getSubmission: () => submission,
  };
}
