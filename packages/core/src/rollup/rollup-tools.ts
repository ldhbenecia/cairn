import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { assertNoForbiddenPayload, sanitizeCairnError } from '../common/sanitize.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';

export interface RollupSummarizerInput {
  activity: RollupActivity;
}

export const submitRollupSchema = z.object({
  paragraphKo: z.string().min(1).max(2500),
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
    paragraphKo: string;
    doneBullets: readonly string[];
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
      paragraphKo: s.paragraphKo,
      doneBullets: s.doneBullets,
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

export function buildRollupTools(input: RollupSummarizerInput): RollupToolsBundle {
  let submission: SubmitRollupInput | null = null;

  const getRollupActivity = tool(
    'get_rollup_activity',
    'Returns the period activity in one call: metrics totals, per-day daily metadata, and per-day summary text already produced for daily worklogs. Call this exactly once, then call submit_rollup.',
    {},
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      const payload = buildRollupActivityPayload(input);
      assertNoForbiddenPayload(payload, 'tool.get_rollup_activity');
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  const submitRollup = tool(
    'submit_rollup',
    'Submit the Korean rollup summary and exit. Call exactly once after get_rollup_activity has provided context. paragraphKo + themes + highlights must be Korean.',
    submitRollupSchema.shape,
    // eslint-disable-next-line @typescript-eslint/require-await
    async (raw) => {
      submission = submitRollupSchema.parse(raw);
      return { content: [{ type: 'text', text: 'Rollup submitted. Exiting.' }] };
    },
  );

  const server = createSdkMcpServer({
    name: 'cairn-rollup',
    tools: [getRollupActivity, submitRollup],
  });

  return {
    server,
    getSubmission: () => submission,
  };
}
