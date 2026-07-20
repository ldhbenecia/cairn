// 기간별 정리(reports) 뷰의 순수 헬퍼 — 일지 Done 불릿을 레포×날짜 타임라인으로 변환

export type DoneItem = { date: string; repo: string | null; text: string };

// 프리픽스 브래킷 한 조각 — `[repo]` 외에 볼드(`**[repo]**`·`[**repo**]`), 마크다운 링크
// `[repo](url)`, 괄호 안팎 공백 변형까지 허용. 링크의 URL 파트는 버리고 라벨만 취한다
const BRACKET_RE = /^\*{0,2}\[\s*\*{0,2}([^\]]+?)\*{0,2}\s*\](?:\([^)]*\))?\*{0,2}\s*/;

// 브래킷 없는 bare repo — 노션 Done 그룹핑이 `[계정]` 을 헤딩으로 옮긴 뒤의 불릿 형태.
// `repo — text` / `repo #N — text` (em/en dash)
const BARE_REPO_RE = /^([A-Za-z][A-Za-z0-9._/-]*)\s+(?:(#\d+)\s+)?[—–]\s+(.+)$/;

// `cairn desktop: …`, `Cashwalk AdminServer: …` — 영문 1~3 단어 + 콜론 프리픽스
const COLON_REPO_RE = /^([A-Za-z][A-Za-z0-9._/-]*(?:\s[A-Za-z][A-Za-z0-9._/-]*){0,2}):\s+(.+)$/;

// '[label] [repo] …' 는 두 번째 브래킷이 레포 (wrapped.topProjects 와 같은 문법)
export function parseDoneBullet(date: string, bullet: string): DoneItem {
  const src = bullet.trim();
  const first = BRACKET_RE.exec(src);
  if (first) {
    const rest = src.slice(first[0].length);
    const second = BRACKET_RE.exec(rest);
    if (second) {
      const text = rest.slice(second[0].length).trim();
      return { date, repo: second[1]!, text: text || src };
    }
    // '[계정] repo — text' 처럼 브래킷 뒤 bare repo 가 오면 그것이 레포
    return parseBareRepo(date, rest) ?? { date, repo: first[1]!, text: rest.trim() || src };
  }
  return parseBareRepo(date, src) ?? { date, repo: null, text: src };
}

function parseBareRepo(date: string, s: string): DoneItem | null {
  const dash = BARE_REPO_RE.exec(s);
  if (dash) {
    return { date, repo: dash[1]!, text: dash[2] ? `${dash[2]} ${dash[3]}` : dash[3]! };
  }
  const colon = COLON_REPO_RE.exec(s);
  if (colon) return { date, repo: colon[1]!, text: colon[2]! };
  return null;
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

// 레인(레포) 고정 팔레트 — 카테고리 도트 색상환(indigo/sky/violet) + teal/amber 확장, 레포 순서 배정
export const LANE_COLORS = ['#5b61e6', '#2f6fa8', '#7c4aa8', '#2f8f7f', '#a8862f'];

export type LanePeak = { date: string; count: number };

export type Lane = { repo: string | null; count: number; dates: string[]; peaks: LanePeak[] };

// 마일스톤 후보 — 2건 이상인 날만(전부 1건이면 상위일이 무의미) 건수 내림차순 상위 2곳
function lanePeaks(days: ReadonlyMap<string, number>): LanePeak[] {
  return [...days.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([date, count]) => ({ date, count }));
}

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
      peaks: lanePeaks(days),
    }))
    .sort((a, b) => {
      if ((a.repo === null) !== (b.repo === null)) return a.repo === null ? 1 : -1;
      return b.count - a.count || (a.repo ?? '').localeCompare(b.repo ?? '');
    });
}

export type TimelineTick = { date: string; pos: number };

export type TimelineAxis = { months: TimelineTick[]; days: TimelineTick[] };

// Linear 문법 2단 날짜 축 — 위: 월 라벨(기간 시작 + 매월 1일), 아래: 일 눈금(주 단위 월요일,
// 2주 이하 기간은 매일). 좁은 첫 달 조각은 라벨 겹침 방지로 드랍, 긴 기간은 주 눈금을 성기게(≤26개)
export function timelineAxis(since: string, until: string): TimelineAxis {
  const span = daySpan(since, until);
  const daily = span <= 14;
  const months: TimelineTick[] = [{ date: since, pos: 0 }];
  const dayTicks: TimelineTick[] = [];
  for (let i = 0; i < span; i++) {
    const date = i === 0 ? since : addDays(since, i);
    if (i > 0 && date.endsWith('-01')) months.push({ date, pos: i / span });
    if (daily || new Date(utcMs(date)).getUTCDay() === 1) dayTicks.push({ date, pos: i / span });
  }
  if (months.length > 1 && months[1]!.pos < 0.06) months.shift();
  const step = Math.max(1, Math.ceil(dayTicks.length / 26));
  return { months, days: dayTicks.filter((_, i) => i % step === 0) };
}
