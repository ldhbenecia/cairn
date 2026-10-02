export interface UtcWindow {
  startIso: string;
  endIso: string;
}

// "YYYY-MM-DD"(사용자 로컬 날짜) → 그 날 하루의 UTC 윈도우
// 로컬 생성자라 머신 TZ·DST 반영
export function localDateToUtcWindow(date: string): UtcWindow {
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid date: ${date}`);
  }
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  // end 를 고정 23:59:59 로 잡으면 자정 근처 DST 폴백 TZ 에서 반복 시간대 커밋이 어느 날에도 안 잡힘
  // 다음날 로컬 자정 − 1ms 로 유도해 다음날 start 와 구조적으로 인접
  const end = new Date(new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime() - 1);
  return {
    startIso: trimMillis(start),
    endIso: trimMillis(end),
  };
}

export function searchRangeFragment(window: UtcWindow): string {
  return `${window.startIso}..${window.endIso}`;
}

// "YYYY-MM-DD"(로컬 날짜)보다 days 일 이전 날의 로컬 자정 → UTC ISO
// 로컬 생성자라 day 음수 rollover·DST 반영
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

export function todayLocalIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
