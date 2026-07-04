import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { sanitizeCairnError } from '../common/sanitize.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';

export interface RollupSummarizerInput {
  activity: RollupActivity;
}

export const submitRollupSchema = z.object({
  paragraph: z.string().min(1).max(2500),
  themes: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        items: z.array(z.string().min(1).max(300)).max(20),
      }),
    )
    .max(10),
  highlights: z.array(z.string().min(1).max(300)).max(10),
});

export type SubmitRollupInput = z.infer<typeof submitRollupSchema>;

interface RollupActivityPayload {
  period: 'weekly' | 'monthly';
  rangeStart: string;
  rangeEnd: string;
  metrics: {
    prCount: number;
    commitCount: number;
    notionPageCount: number;
    dailyCount: number;
  };
  dailies: ReadonlyArray<{
    date: string;
    url: string;
    prCount: number;
    commitCount: number;
    notionPageCount: number;
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
    metrics: a.metrics,
    dailies: a.dailies.map((d) => ({
      date: d.date,
      url: d.url,
      prCount: d.prCount,
      commitCount: d.commitCount,
      notionPageCount: d.notionPageCount,
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
