// 기간별 정리(reports) 뷰의 순수 헬퍼 — 일지 Done 불릿을 레포×날짜 타임라인으로 변환

export type DoneItem = { date: string; repo: string | null; text: string };

// 프리픽스 브래킷 한 조각 — `[repo]` 외에 볼드(`**[repo]**`·`[**repo**]`), 마크다운 링크
// `[repo](url)`, 괄호 안팎 공백 변형까지 허용. 링크의 URL 파트는 버리고 라벨만 취한다
const BRACKET_RE = /^\*{0,2}\[\s*\*{0,2}([^\]]+?)\*{0,2}\s*\](?:\([^)]*\))?\*{0,2}\s*/;

// 브래킷 없는 bare repo — 노션 Done 그룹핑이 `[계정]` 을 헤딩으로 옮긴 뒤의 불릿 형태.
// `repo — text` / `repo #N — text` — 구분자는 em/en dash 와 ASCII 하이픈(` - `) 동일 취급,
// 뒤 텍스트에 dash 가 또 나와도 첫 구분자 기준
const BARE_REPO_RE = /^([A-Za-z][A-Za-z0-9._/-]*)\s+(?:(#\d+)\s+)?[—–-]\s+(.+)$/;

// `cairn desktop: …`, `Cashwalk AdminServer: …` — 영문 1~3 단어 + 콜론 프리픽스
const COLON_REPO_RE = /^([A-Za-z][A-Za-z0-9._/-]*(?:\s[A-Za-z][A-Za-z0-9._/-]*){0,2}):\s+(.+)$/;

// 2-pass 파싱 — 콜론/bare 패턴은 'fix'·'CMS'·클래스명 같은 일반 프리픽스를 레포로 오인하기
// 쉬워, 1차에서 대괄호 프리픽스가 확정한 신뢰 레포 집합에 일치할 때만 레포로 인정한다
export function parseDoneItems(
  days: readonly { date: string; bullets: readonly string[] }[],
): DoneItem[] {
  const trusted = new Set<string>();
  for (const d of days) {
    for (const b of d.bullets) {
      const repo = bracketRepo(b.trim());
      if (repo) trusted.add(repo);
    }
  }
  return days.flatMap((d) => d.bullets.map((b) => parseDoneBullet(d.date, b, trusted)));
}

// 1차 — 대괄호 프리픽스가 확정하는 레포만 (두 브래킷이면 두 번째, 브래킷+bare 면 bare)
function bracketRepo(src: string): string | null {
  const first = BRACKET_RE.exec(src);
  if (!first) return null;
  const rest = src.slice(first[0].length);
  const second = BRACKET_RE.exec(rest);
  if (second) return second[1]!;
  return BARE_REPO_RE.exec(rest)?.[1] ?? first[1]!;
}

// '[label] [repo] …' 는 두 번째 브래킷이 레포 (wrapped.topProjects 와 같은 문법)
export function parseDoneBullet(
  date: string,
  bullet: string,
  trusted: ReadonlySet<string> = new Set(),
): DoneItem {
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
    return (
      parseBareRepo(date, rest, true, trusted) ?? {
        date,
        repo: first[1]!,
        text: rest.trim() || src,
      }
    );
  }
  return parseBareRepo(date, src, false, trusted) ?? { date, repo: null, text: src };
}

// 브래킷 라벨 뒤(bracketed)의 bare/콜론은 구조 신호가 강해 그대로 신뢰,
// 맨몸 콜론/대시는 신뢰 집합에 매치될 때만 레포 (2-pass 2차)
function parseBareRepo(
  date: string,
  s: string,
  bracketed: boolean,
  trusted: ReadonlySet<string>,
): DoneItem | null {
  const dash = BARE_REPO_RE.exec(s);
  if (dash) {
    const repo = bracketed ? dash[1]! : matchTrusted(dash[1]!, trusted);
    if (repo) return { date, repo, text: dash[2] ? `${dash[2]} ${dash[3]}` : dash[3]! };
  }
  const colon = COLON_REPO_RE.exec(s);
  if (colon) {
    const name = colon[1]!;
    const repo = bracketed ? name : matchTrusted(name, trusted);
    if (repo) return { date, repo, text: colon[2]! };
    // 'cairn desktop' 처럼 신뢰 레포명+공백+단어 는 해당 신뢰 레포('cairn')로 귀속
    const words = name.split(' ');
    for (let n = words.length - 1; n >= 1; n--) {
      const prefix = words.slice(0, n).join(' ');
      if (trusted.has(prefix)) {
        return { date, repo: prefix, text: `${words.slice(n).join(' ')}: ${colon[2]!}` };
      }
    }
  }
  return null;
}

const normalizeName = (s: string): string => s.toLowerCase().replace(/[\s-]+/g, '');

// 토큰들이 순서대로(겹침 없이) 모두 등장하는지 — 부분 생략형 매칭용
function tokensInOrder(tokens: readonly string[], hay: string): boolean {
  let idx = 0;
  for (const tk of tokens) {
    const at = hay.indexOf(tk, idx);
    if (at === -1) return false;
    idx = at + tk.length;
  }
  return true;
}

// 후보를 신뢰 레포명에 정규화 비교로 귀속 — 공백/하이픈·대소문자 변형은 정확 일치
// ('Cashwalk Backend' == 'CashwalkBackend'), 부분 생략형은 후보 토큰이 신뢰 레포명에
// 순서대로 모두 포함될 때 ('Cashwalk AdminServer' ⊂ 'CashwalkTeamwalkAdminServer').
// 오탐 가드 — 부분 생략형은 2단어 이상 또는 6자 이상만, 복수 신뢰 레포에 매치되면 포기
function matchTrusted(name: string, trusted: ReadonlySet<string>): string | null {
  if (trusted.has(name)) return name;
  const norm = normalizeName(name);
  for (const t of trusted) if (normalizeName(t) === norm) return t;
  const tokens = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(normalizeName);
  if (tokens.length < 2 && norm.length < 6) return null;
  const hits = [...trusted].filter((t) => tokensInOrder(tokens, normalizeName(t)));
  return hits.length === 1 ? hits[0]! : null;
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

// 타임라인 표시 순서 — 최근 활동일(dates 마지막) 내림차순, null 레포는 마지막, 동률은 레포명.
// 레이지 로드로 과거 청크를 더 불러와도 기존 레인의 마지막 활동일은 안 바뀌므로 순서가
// 불변이다(더 오래된 레포만 뒤에 붙는다) — 진입/스크롤 로드 시 레인 재정렬·재배색 방지.
export function orderLanesStable(lanes: readonly Lane[]): Lane[] {
  return [...lanes].sort((a, b) => {
    if ((a.repo === null) !== (b.repo === null)) return a.repo === null ? 1 : -1;
    const al = a.dates[a.dates.length - 1] ?? '';
    const bl = b.dates[b.dates.length - 1] ?? '';
    return bl.localeCompare(al) || (a.repo ?? '').localeCompare(b.repo ?? '');
  });
}

export type TimelineTick = { date: string; pos: number };

export type TimelineAxis = { months: TimelineTick[]; days: TimelineTick[] };

// 2단 날짜 축 — 위: 월 라벨(기간 시작 + 매월 1일), 아래: 매주 월요일 일 눈금.
// 좁은 첫 달 조각은 라벨 겹침 방지로 드랍. px/일 고정 스케일이라 눈금 밀도는 기간과 무관하게 일정
export function timelineAxis(since: string, until: string): TimelineAxis {
  const span = daySpan(since, until);
  const months: TimelineTick[] = [{ date: since, pos: 0 }];
  const days: TimelineTick[] = [];
  for (let i = 0; i < span; i++) {
    const date = i === 0 ? since : addDays(since, i);
    if (i > 0 && date.endsWith('-01')) months.push({ date, pos: i / span });
    if (new Date(utcMs(date)).getUTCDay() === 1) days.push({ date, pos: i / span });
  }
  if (months.length > 1 && months[1]!.pos < 0.06) months.shift();
  return { months, days };
}
