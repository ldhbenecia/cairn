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

// 작년 12/31 — yearly 롤업 anchor. 한 해 내내 같은 값.
export function lastCompletedYearAnchor(now: Date): string {
  return `${now.getFullYear() - 1}-12-31`;
}

export function localTodayIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// 휴가 등으로 여러 기간을 놓쳤을 때 한 번에 발행할 상한 — 복귀 시 수십 개가 버스트하지 않게.
// 초과분은 오래된 것부터 상한만큼 발행하고 나머지는 다음 실행에서 이어받는다(anchor 전진).
const MAX_CATCHUP = 12;

const iso = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// last(마지막 발행 anchor) 이후 ~ 현재 완료 주까지의 모든 주-끝(일요일) anchor 를 오래된 순으로.
// last 가 없으면(최초) 현재 것만 — 과거 전체를 백필하지 않는다.
export function weekAnchorsToPublish(last: string | undefined, now: Date): string[] {
  const current = lastCompletedWeekAnchor(now);
  if (!last) return [current];
  const out: string[] = [];
  const [y, m, d] = last.split('-').map(Number);
  if (!y || !m || !d) return current > last ? [current] : [];
  const cursor = new Date(y, m - 1, d);
  while (out.length < MAX_CATCHUP) {
    cursor.setDate(cursor.getDate() + 7); // last 는 일요일 — 다음 일요일들
    const a = iso(cursor);
    if (a > current) break;
    out.push(a);
  }
  return out;
}

// last 이후 ~ 현재 완료 연도까지의 연-끝(12/31) anchor 를 오래된 순으로.
export function yearAnchorsToPublish(last: string | undefined, now: Date): string[] {
  const current = lastCompletedYearAnchor(now);
  if (!last) return [current];
  const out: string[] = [];
  const y = Number(last.split('-')[0]);
  if (!y) return current > last ? [current] : [];
  for (let yy = y + 1; out.length < MAX_CATCHUP; yy++) {
    const a = `${yy}-12-31`;
    if (a > current) break;
    out.push(a);
  }
  return out;
}

// last 이후 ~ 현재 완료 월까지의 모든 월-끝 anchor 를 오래된 순으로.
export function monthAnchorsToPublish(last: string | undefined, now: Date): string[] {
  const current = lastCompletedMonthAnchor(now);
  if (!last) return [current];
  const out: string[] = [];
  const [y, m] = last.split('-').map(Number);
  if (!y || !m) return current > last ? [current] : [];
  let yy = y;
  let m0 = m - 1; // last 가 닫는 달의 0-based index
  while (out.length < MAX_CATCHUP) {
    m0 += 1;
    if (m0 > 11) {
      m0 = 0;
      yy += 1;
    }
    const a = iso(new Date(yy, m0 + 1, 0)); // 그 달의 마지막 날
    if (a > current) break;
    out.push(a);
  }
  return out;
}
