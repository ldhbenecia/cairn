import type { RecentPage } from '../cairn-api';

export type WrappedStats = {
  year: string;
  pr: number;
  commit: number;
  activeDays: number;
  longestStreak: number;
  byMonth: { pr: number; commit: number }[];
  byWeekday: number[];
  byHour: number[];
  busiestDay: { date: string; total: number } | null;
};

export function availableYears(pages: readonly RecentPage[]): string[] {
  const years = new Set<string>();
  for (const p of pages) {
    if (p.category === 'daily' && p.date) years.add(p.date.slice(0, 4));
  }
  return [...years].sort().reverse();
}

export function computeWrapped(pages: readonly RecentPage[], year: string): WrappedStats {
  const dailies = pages.filter((p) => p.category === 'daily' && p.date?.startsWith(`${year}-`));
  const byMonth = Array.from({ length: 12 }, () => ({ pr: 0, commit: 0 }));
  const byWeekday = new Array<number>(7).fill(0);
  const byHour = new Array<number>(24).fill(0);
  const activeDates: string[] = [];
  let pr = 0;
  let commit = 0;
  let busiestDay: { date: string; total: number } | null = null;

  for (const p of dailies) {
    const date = p.date!;
    const total = (p.pr ?? 0) + (p.commit ?? 0);
    pr += p.pr ?? 0;
    commit += p.commit ?? 0;
    if (total > 0) activeDates.push(date);
    const month = Number(date.slice(5, 7)) - 1;
    if (byMonth[month]) {
      byMonth[month].pr += p.pr ?? 0;
      byMonth[month].commit += p.commit ?? 0;
    }
    // 요일은 달력 산술 — UTC 로만 계산 (로컬 TZ 무관)
    const [y, m, d] = date.split('-').map(Number);
    byWeekday[new Date(Date.UTC(y!, m! - 1, d)).getUTCDay()]! += total;
    if (p.hours?.length === 24) {
      for (let h = 0; h < 24; h++) byHour[h]! += p.hours[h]!;
    }
    if (total > 0 && (!busiestDay || total > busiestDay.total)) busiestDay = { date, total };
  }

  return {
    year,
    pr,
    commit,
    activeDays: activeDates.length,
    longestStreak: longestStreak(activeDates),
    byMonth,
    byWeekday,
    byHour,
    busiestDay,
  };
}

export function longestStreak(dates: readonly string[]): number {
  if (dates.length === 0) return 0;
  const days = [...new Set(dates)]
    .map((d) => {
      const [y, m, dd] = d.split('-').map(Number);
      return Date.UTC(y!, m! - 1, dd) / 86_400_000;
    })
    .sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i]! - days[i - 1]! === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// 일지 Done bullet 의 '[repo]' 프리픽스 집계 — 계정 라벨 프리픽스('[work] [repo] …')는 두 번째 것 사용
export function topProjects(
  bullets: readonly string[],
  limit = 5,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  const RE = /^\[([^\]]+)\]\s*(?:\[([^\]]+)\]\s*)?/;
  for (const b of bullets) {
    const m = RE.exec(b);
    if (!m) continue;
    const name = m[2] ?? m[1];
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
