import type { RollupPeriod } from '../contracts/rollup-activity.types.js';

export interface PeriodRange {
  start: string;
  end: string;
}

export function periodRange(period: RollupPeriod, localDate: string): PeriodRange {
  return period === 'weekly' ? isoWeekRange(localDate) : monthRange(localDate);
}

export function isoWeekRange(localDate: string): PeriodRange {
  const { y, m, d } = parseLocalDate(localDate);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(Date.UTC(y, m - 1, d - daysFromMonday));
  const sunday = new Date(Date.UTC(y, m - 1, d - daysFromMonday + 6));
  return { start: formatYmd(monday), end: formatYmd(sunday) };
}

export function monthRange(localDate: string): PeriodRange {
  const { y, m } = parseLocalDate(localDate);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: formatYmd(start), end: formatYmd(end) };
}

export function isoWeekLabel(rangeStart: string): string {
  const { y, m, d } = parseLocalDate(rangeStart);
  const target = new Date(Date.UTC(y, m - 1, d));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(firstThursday, 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((target.getTime() - yearStart.getTime()) / 86_400_000 -
        3 +
        ((yearStart.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${firstThursday}-W${String(weekNum).padStart(2, '0')}`;
}

export function monthLabel(rangeStart: string): string {
  const { y, m } = parseLocalDate(rangeStart);
  return `${y}-${String(m).padStart(2, '0')}`;
}

function parseLocalDate(localDate: string): { y: number; m: number; d: number } {
  const parts = localDate.split('-').map(Number);
  const [y, m, d] = parts;
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`invalid localDate: ${localDate}`);
  }
  return { y, m, d };
}

function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
