// 기간별 정리(reports) 뷰의 순수 헬퍼 — 일지 Done 불릿을 레포×날짜 타임라인으로 변환

export type DoneItem = { date: string; repo: string | null; text: string };

// wrapped.topProjects 와 같은 프리픽스 문법 — '[label] [repo] …' 는 두 번째 것이 레포
const PREFIX_RE = /^\[([^\]]+)\]\s*(?:\[([^\]]+)\]\s*)?/;

export function parseDoneBullet(date: string, bullet: string): DoneItem {
  const m = PREFIX_RE.exec(bullet);
  if (!m) return { date, repo: null, text: bullet };
  const text = bullet.slice(m[0].length).trim();
  return { date, repo: m[2] ?? m[1] ?? null, text: text || bullet };
}

// N일 전 로컬 날짜(YYYY-MM-DD). 로컬 자정 기준 — KST 단정 금지(timezone 룰)
export function localDateDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

// ISO 날짜 문자열 간 달력 산술 — UTC 로만 계산 (로컬 TZ/DST 무관, wrapped.ts 와 동일 원칙)
const utcMs = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
};

export function dayIndex(since: string, date: string): number {
  return Math.round((utcMs(date) - utcMs(since)) / 86_400_000);
}

export function daySpan(since: string, until: string): number {
  return dayIndex(since, until) + 1;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(utcMs(iso) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export type Lane = { repo: string | null; count: number; dates: string[] };

// 항목 많은 레포 순 정렬, 프리픽스 없는 묶음(null)은 마지막
export function buildLanes(items: readonly DoneItem[]): Lane[] {
  const byRepo = new Map<string | null, Map<string, number>>();
  for (const it of items) {
    const days = byRepo.get(it.repo) ?? new Map<string, number>();
    days.set(it.date, (days.get(it.date) ?? 0) + 1);
    byRepo.set(it.repo, days);
  }
  return [...byRepo.entries()]
    .map(([repo, days]) => ({
      repo,
      count: [...days.values()].reduce((a, b) => a + b, 0),
      dates: [...days.keys()].sort(),
    }))
    .sort((a, b) => {
      if ((a.repo === null) !== (b.repo === null)) return a.repo === null ? 1 : -1;
      return b.count - a.count || (a.repo ?? '').localeCompare(b.repo ?? '');
    });
}

export type TimelineTick = { date: string; pos: number };

// 기간 길이에 따라 주(월요일) 또는 월(1일) 경계 눈금 — pos 는 0..1 (기간 좌측 경계 기준)
export function timelineTicks(
  since: string,
  until: string,
): { unit: 'week' | 'month'; ticks: TimelineTick[] } {
  const span = daySpan(since, until);
  const weekly = span <= 45;
  const ticks: TimelineTick[] = [];
  for (let i = 1; i < span; i++) {
    const date = addDays(since, i);
    const hit = weekly ? new Date(utcMs(date)).getUTCDay() === 1 : date.endsWith('-01');
    if (hit) ticks.push({ date, pos: i / span });
  }
  return { unit: weekly ? 'week' : 'month', ticks };
}
