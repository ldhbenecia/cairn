import type { RollupPeriod } from '../contracts/rollup-activity.types.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import { isoWeekLabel, monthLabel } from '../rollup/period-range.js';

export interface DailyVaultInput {
  date: string;
  lang: 'ko' | 'en';
  summary: WorklogSummary;
  prCount: number;
  commitCount: number;
  hours: readonly number[];
  notionPageId?: string | null;
}

export interface RollupVaultInput {
  period: RollupPeriod;
  rangeStart: string;
  rangeEnd: string;
  lang: 'ko' | 'en';
  summary: RollupSummary;
  dailyDates: readonly string[];
  prCount: number;
  commitCount: number;
  notionPageId?: string | null;
}

export function dailyFileName(date: string): string {
  return `${date}.md`;
}

export function rollupFileName(period: RollupPeriod, rangeStart: string): string {
  return period === 'weekly' ? `${isoWeekLabel(rangeStart)}.md` : `${monthLabel(rangeStart)}.md`;
}

export function renderDailyVaultMarkdown(input: DailyVaultInput): string {
  const title = `${input.date} ${input.lang === 'en' ? 'Worklog' : '작업 일지'}`;
  const fm = frontmatter([
    ['date', input.date],
    ['period', 'daily'],
    ['title', title],
    ['pr', input.prCount],
    ['commit', input.commitCount],
    ['hours', [...input.hours]],
    ['notion', input.notionPageId ?? null],
  ]);
  const s = input.summary;
  const body: string[] = ['## Summary', '', s.paragraph, ''];
  pushBullets(body, 'Share', s.shareBullets);
  pushBullets(body, 'Done', s.doneBullets);
  pushBullets(body, 'Reviewed', s.reviewedBullets);
  pushBullets(body, 'In Progress', s.inProgressBullets);
  pushBullets(body, 'Notes', s.notesBullets);
  return `${fm}\n# ${title}\n\n${body.join('\n').trimEnd()}\n`;
}

export function renderRollupVaultMarkdown(input: RollupVaultInput): string {
  const label =
    input.period === 'weekly' ? isoWeekLabel(input.rangeStart) : monthLabel(input.rangeStart);
  const title = `${label} ${
    input.lang === 'en'
      ? input.period === 'weekly'
        ? 'Weekly Rollup'
        : 'Monthly Rollup'
      : input.period === 'weekly'
        ? '주간 정리'
        : '월간 정리'
  }`;
  const fm = frontmatter([
    ['date', input.rangeStart],
    ['period', input.period],
    ['title', title],
    ['rangeStart', input.rangeStart],
    ['rangeEnd', input.rangeEnd],
    ['pr', input.prCount],
    ['commit', input.commitCount],
    ['notion', input.notionPageId ?? null],
  ]);
  const s = input.summary;
  const body: string[] = ['## Summary', '', s.paragraph, ''];
  pushBullets(body, 'Highlights', s.highlights);
  for (const theme of s.themes) {
    pushBullets(body, theme.title, theme.items);
  }
  if (input.dailyDates.length > 0) {
    body.push('## Dailies', '');
    for (const d of input.dailyDates) body.push(`- [[${d}]]`);
    body.push('');
  }
  return `${fm}\n# ${title}\n\n${body.join('\n').trimEnd()}\n`;
}

function pushBullets(body: string[], heading: string, bullets: readonly string[]): void {
  if (bullets.length === 0) return;
  body.push(`## ${heading}`, '');
  for (const b of bullets) body.push(`- ${b}`);
  body.push('');
}

// 값 종류가 한정돼 있어 yaml 라이브러리 없이 직렬화 (string·number·number[]·null)
function frontmatter(fields: readonly [string, string | number | number[] | null][]): string {
  const lines = ['---'];
  for (const [key, value] of fields) {
    if (value === null) continue;
    if (Array.isArray(value)) lines.push(`${key}: [${value.join(',')}]`);
    else if (typeof value === 'number') lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push('---');
  return `${lines.join('\n')}\n`;
}

function yamlString(value: string): string {
  // 날짜·제목 수준의 값이라 특수문자 있을 때만 쿼트
  if (/^[\w .\-가-힣]+$/u.test(value)) return value;
  return JSON.stringify(value);
}
