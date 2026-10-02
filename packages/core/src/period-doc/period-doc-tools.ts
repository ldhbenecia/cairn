import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import type { WorklogLang } from '../cairn/run-options.js';

export const submitPeriodDocSchema = z.object({
  overview: z.string().min(1).max(1500),
  projects: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        summary: z.string().min(1).max(300).optional(),
        items: z.array(z.string().min(1).max(300)).min(1).max(10),
      }),
    )
    .min(1)
    .max(12),
});

export type PeriodDocSubmission = z.infer<typeof submitPeriodDocSchema>;

export interface PeriodDocMetrics {
  journalCount: number;
  prCount: number;
  commitCount: number;
}

export interface PeriodDocPayload {
  rangeStart: string;
  rangeEnd: string;
  metrics: PeriodDocMetrics;
  days: { date: string; done: string[] }[];
}

// 사용자가 편집한 일지 불릿에 경로·diff·토큰이 섞일 수 있다 — 위반 불릿만 빼고 계속 (ADR 0021)
export function buildPeriodDocPayload(input: {
  rangeStart: string;
  rangeEnd: string;
  metrics: PeriodDocMetrics;
  days: readonly { date: string; done: readonly string[] }[];
}): { payload: PeriodDocPayload; dropped: number } {
  let dropped = 0;
  const days: PeriodDocPayload['days'] = [];
  for (const d of input.days) {
    const done = d.done.filter((b) => {
      try {
        assertNoForbiddenPayload(b, 'period-doc.bullet');
        return true;
      } catch {
        dropped++;
        return false;
      }
    });
    if (done.length > 0) days.push({ date: d.date, done });
  }
  const payload: PeriodDocPayload = {
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    metrics: input.metrics,
    days,
  };
  assertNoForbiddenPayload(payload, 'period-doc.payload');
  return { payload, dropped };
}

export function periodDocFileName(since: string, until: string): string {
  return `${since}_${until}.md`;
}

const LABELS = {
  ko: { title: '기간 정리', overview: '요약', stats: '일지 {j} · PR {p} · 커밋 {c}' },
  en: {
    title: 'Period summary',
    overview: 'Overview',
    stats: '{j} worklogs · {p} PRs · {c} commits',
  },
} as const;

export function renderPeriodDocMarkdown(input: {
  since: string;
  until: string;
  lang: WorklogLang;
  metrics: PeriodDocMetrics;
  submission: PeriodDocSubmission;
  model?: string;
}): string {
  const l = LABELS[input.lang];
  const { metrics: m, submission: s } = input;
  const title = `${l.title} ${input.since} – ${input.until}`;
  const stats = l.stats
    .replace('{j}', String(m.journalCount))
    .replace('{p}', String(m.prCount))
    .replace('{c}', String(m.commitCount));
  const lines = [
    '---',
    'period: custom',
    `since: ${input.since}`,
    `until: ${input.until}`,
    `title: ${title}`,
    `journals: ${m.journalCount}`,
    `pr: ${m.prCount}`,
    `commit: ${m.commitCount}`,
    ...(input.model ? [`model: ${input.model}`] : []),
    '---',
    '',
    `# ${title}`,
    '',
    stats,
    '',
    `## ${l.overview}`,
    '',
    s.overview,
  ];
  for (const p of s.projects) {
    lines.push('', `## ${projectName(p.name)}`, '');
    if (p.summary) lines.push(oneLine(p.summary), '');
    for (const item of p.items) lines.push(`- ${oneLine(item)}`);
  }
  return `${lines.join('\n')}\n`;
}

// 모델 출력의 개행이 헤딩·불릿 구조를 깨지 않게
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

// 모델이 불릿 브래킷을 그대로 옮기는 경우('[계정] [repo]') — 마지막 브래킷이 레포 (실측)
function projectName(name: string): string {
  const brackets = [...name.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!.trim());
  return oneLine(brackets.at(-1) ?? name);
}

export function buildPeriodDocTools(): {
  server: ReturnType<typeof createSdkMcpServer>;
  getSubmission: () => PeriodDocSubmission | null;
} {
  let submission: PeriodDocSubmission | null = null;
  const submit = tool(
    'submit_period_doc',
    'Submit the period summary and exit. Call exactly once after reading the activity data in the user message. All text fields must follow the requested output language.',
    submitPeriodDocSchema.shape,
    // eslint-disable-next-line @typescript-eslint/require-await
    async (raw) => {
      submission = submitPeriodDocSchema.parse(raw);
      return { content: [{ type: 'text', text: 'Period summary submitted. Exiting.' }] };
    },
  );
  return {
    server: createSdkMcpServer({ name: 'cairn-period-doc', tools: [submit] }),
    getSubmission: () => submission,
  };
}
