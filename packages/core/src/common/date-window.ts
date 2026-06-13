export interface UtcWindow {
  startIso: string;
  endIso: string;
}

// "YYYY-MM-DD"(사용자 로컬 캘린더 날짜) → 그 날 하루의 UTC 윈도우.
// 로컬 TZ 기준 (rules/timezone.md) — Date 로컬 생성자가 머신 TZ·DST 를 반영한다.
export function localDateToUtcWindow(date: string): UtcWindow {
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid date: ${date}`);
  }
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 0);
  return {
    startIso: trimMillis(start),
    endIso: trimMillis(end),
  };
}

export function searchRangeFragment(window: UtcWindow): string {
  return `${window.startIso}..${window.endIso}`;
}

// "YYYY-MM-DD"(로컬 날짜) 보다 days 일 이전 날의 로컬 자정 → UTC ISO.
// 로컬 TZ 기준 (rules/timezone.md) — Date 로컬 생성자가 day 음수 rollover·DST 를 반영한다.
export function localDateStartIsoBefore(date: string, days: number): string {
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid date: ${date}`);
  }
  const start = new Date(year, month - 1, day - days, 0, 0, 0, 0);
  return trimMillis(start);
}

function trimMillis(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// 사용자 로컬 기준 오늘 "YYYY-MM-DD"
export function todayLocalIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
