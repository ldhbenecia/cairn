import type { RollupPeriod } from '../contracts/rollup-activity.types.js';
import type { RollupSummary } from '../contracts/rollup-summary.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import { isoWeekLabel, monthLabel, yearLabel } from '../rollup/period-range.js';

export interface DailyJournalInput {
  date: string;
  lang: 'ko' | 'en';
  summary: WorklogSummary;
  prCount: number;
  commitCount: number;
  hours: readonly number[];
  notionPageId?: string | null;
}

export interface RollupJournalInput {
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
  if (period === 'weekly') return `${isoWeekLabel(rangeStart)}.md`;
  if (period === 'monthly') return `${monthLabel(rangeStart)}.md`;
  return `${yearLabel(rangeStart)}.md`;
}

export function renderDailyJournalMarkdown(input: DailyJournalInput): string {
  const title = `${input.date} ${input.lang === 'en' ? 'Worklog' : '작업 일지'}`;
  const fm = frontmatter([
    ['date', input.date],
    ['period', 'daily'],
    ['title', title],
    ['pr', input.prCount],
    ['commit', input.commitCount],
    ['hours', [...input.hours]],
    ['model', input.summary.usage?.model ?? null],
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

const ROLLUP_TITLE: Record<RollupPeriod, { ko: string; en: string }> = {
  weekly: { ko: '주간 정리', en: 'Weekly Rollup' },
  monthly: { ko: '월간 정리', en: 'Monthly Rollup' },
  yearly: { ko: '연간 정리', en: 'Yearly Rollup' },
};

function rollupLabel(period: RollupPeriod, rangeStart: string): string {
  if (period === 'weekly') return isoWeekLabel(rangeStart);
  if (period === 'monthly') return monthLabel(rangeStart);
  return yearLabel(rangeStart);
}

export function renderRollupJournalMarkdown(input: RollupJournalInput): string {
  const title = `${rollupLabel(input.period, input.rangeStart)} ${ROLLUP_TITLE[input.period][input.lang]}`;
  const fm = frontmatter([
    ['date', input.rangeStart],
    ['period', input.period],
    ['title', title],
    ['rangeStart', input.rangeStart],
    ['rangeEnd', input.rangeEnd],
    ['pr', input.prCount],
    ['commit', input.commitCount],
    ['model', input.summary.usage?.model ?? null],
    ['notion', input.notionPageId ?? null],
  ]);
  const s = input.summary;
  const body: string[] = ['## Summary', '', s.paragraph, ''];
  if (s.commentary) body.push('## Commentary', '', s.commentary, '');
  pushBullets(body, 'Highlights', s.highlights);
  for (const theme of s.themes) {
    pushBullets(body, theme.title, theme.items);
  }
  if (input.dailyDates.length > 0) {
    // yearly 는 월간 정리들을 합성하므로 링크 대상도 월간 파일
    body.push(input.period === 'yearly' ? '## Monthlies' : '## Dailies', '');
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
