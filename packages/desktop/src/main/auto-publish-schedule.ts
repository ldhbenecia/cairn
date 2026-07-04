// auto-publish 의 순수 날짜/시각 계산 — electron 의존 없음(테스트 가능). 로컬 TZ 기준(rules/timezone.md)

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function msUntilLocalTime(time: string, now: Date = new Date()): number {
  const parts = time.split(':');
  const h = Number.parseInt(parts[0] ?? '', 10);
  const m = Number.parseInt(parts[1] ?? '', 10);
  const next = new Date(now);
  next.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function isScheduledTimeReached(now: Date, time: string): boolean {
  const [hStr, mStr] = time.split(':');
  const h = Number.parseInt(hStr ?? '', 10);
  const m = Number.parseInt(mStr ?? '', 10);
  const sh = Number.isFinite(h) ? h : 19;
  const sm = Number.isFinite(m) ? m : 0;
  return now.getHours() * 60 + now.getMinutes() >= sh * 60 + sm;
}

// 지난주 일요일(이번 주 월요일의 전날) — weekly 롤업 anchor. 한 주 내내 같은 값이라 catch-up 안정적.
export function lastCompletedWeekAnchor(now: Date): string {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7; // Mon→0 … Sun→6
  d.setDate(d.getDate() - sinceMonday - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 지난달 마지막 날 — monthly 롤업 anchor. 한 달 내내 같은 값.
export function lastCompletedMonthAnchor(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function localTodayIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
