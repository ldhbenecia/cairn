import type { RecentCategory } from './notion-client';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

// core rollup/period-range.ts 의 isoWeekLabel 과 동일 규칙 (ISO-8601 주차)
export function isoWeekLabel(date: string): string | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const target = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const year = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((target.getTime() - yearStart.getTime()) / 86_400_000 -
        3 +
        ((yearStart.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// journal 파일명 규칙: daily YYYY-MM-DD.md / weekly YYYY-Wnn.md / monthly YYYY-MM.md
export function journalFileNameFor(category: RecentCategory, date: string): string | null {
  if (!DATE_RE.test(date)) return null;
  if (category === 'daily') return `${date.slice(0, 10)}.md`;
  if (category === 'weekly') {
    const label = isoWeekLabel(date);
    return label ? `${label}.md` : null;
  }
  return `${date.slice(0, 7)}.md`;
}

// obsidian export(export.ts)는 발행 실행일 기준 YYYY-MM-DD[-period].md — 기간 라벨로 정규화해 대조
export function buildExportIndex(names: readonly string[]): Set<string> {
  const index = new Set<string>();
  for (const name of names) {
    const m = /^(\d{4}-\d{2}-\d{2})(?:-(weekly|monthly))?\.md$/.exec(name);
    if (!m?.[1]) continue;
    const key = exportIndexKey((m[2] as RecentCategory | undefined) ?? 'daily', m[1]);
    if (key) index.add(key);
  }
  return index;
}

export function exportIndexKey(category: RecentCategory, date: string): string | null {
  if (!DATE_RE.test(date)) return null;
  if (category === 'daily') return `daily:${date.slice(0, 10)}`;
  if (category === 'weekly') {
    const label = isoWeekLabel(date);
    return label ? `weekly:${label}` : null;
  }
  return `monthly:${date.slice(0, 7)}`;
}
