export interface UtcWindow {
  startIso: string;
  endIso: string;
}

// "YYYY-MM-DD"(사용자 로컬 캘린더 날짜) → 그 날 하루의 UTC 윈도우
// 로컬 TZ 기준 (rules/timezone.md) — Date 로컬 생성자가 머신 TZ·DST 반영
export function localDateToUtcWindow(date: string): UtcWindow {
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid date: ${date}`);
  }
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  // end 를 고정 23:59:59 로 잡으면 자정 근처에서 DST 가 전환되는 TZ(예: 폴백으로 00:00 직전
  // 1시간이 반복)에서 그 반복 시간의 커밋이 어느 날 윈도우에도 안 잡히는 dead zone 이 생긴다.
  // 다음날 로컬 자정 − 1ms 에서 유도하면 다음날 start 와 구조적으로 인접(갭 불가) —
  // 일반일 출력은 그대로 23:59:59(밀리초 절삭), DST 전환일에만 실제 하루 길이를 정확히 반영
  const end = new Date(new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime() - 1);
  return {
    startIso: trimMillis(start),
    endIso: trimMillis(end),
  };
}

export function searchRangeFragment(window: UtcWindow): string {
  return `${window.startIso}..${window.endIso}`;
}

// "YYYY-MM-DD"(로컬 날짜) 보다 days 일 이전 날의 로컬 자정 → UTC ISO
// 로컬 TZ 기준 (rules/timezone.md) — Date 로컬 생성자가 day 음수 rollover·DST 반영
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
