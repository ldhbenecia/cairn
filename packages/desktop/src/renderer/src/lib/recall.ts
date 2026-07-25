import type { RecentPage } from '../cairn-api';
import { addDays, todayLocal } from './reports';

// '그때의 오늘' — 오늘(로컬 날짜) 기준 1주/1달/1년 전의 일간 일지를 되살린다.
// 날짜 산술은 ISO 문자열 + UTC-only 캘린더 계산 — 로컬 TZ 의존 없음(ADR 0016 패턴).
// 월·연 이동은 말일 클램프(예: 07-31 → 06-30, 윤년 02-29 → 평년 02-28)

export type RecallKey = 'week' | 'month' | 'year';
export type RecallEntry = { key: RecallKey; date: string; page: RecentPage };

function shiftMonthsClamped(iso: string, months: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  const first = new Date(Date.UTC(y, m + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, lastDay)))
    .toISOString()
    .slice(0, 10);
}

export function recallDates(todayIso: string): { key: RecallKey; date: string }[] {
  return [
    { key: 'week', date: addDays(todayIso, -7) },
    { key: 'month', date: shiftMonthsClamped(todayIso, -1) },
    { key: 'year', date: shiftMonthsClamped(todayIso, -12) },
  ];
}

// 해당 날짜의 일간 일지가 있는 항목만 — 하나도 없으면 카드 자체를 숨긴다
export function recallEntries(
  pages: readonly RecentPage[],
  todayIso: string = todayLocal(),
): RecallEntry[] {
  const daily = new Map(
    pages
      .filter((p) => p.category === 'daily' && p.date !== null)
      .map((p) => [p.date as string, p]),
  );
  return recallDates(todayIso).flatMap(({ key, date }) => {
    const page = daily.get(date);
    return page ? [{ key, date, page }] : [];
  });
}
