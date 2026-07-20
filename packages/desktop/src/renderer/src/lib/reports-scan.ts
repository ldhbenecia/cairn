import type { RecentListResult, RecentPage } from '../cairn-api';
import { pool, sectionBullets } from './blocks';
import { localDateDaysAgo, todayLocal } from './reports';

export type PerDay = { date: string; bullets: string[] };
export type ScanEntry = { count: number; rows: PerDay[]; disk?: boolean };

type ScanProgressFn = (done: number, total: number) => void;

type InflightScan = {
  promise: Promise<PerDay[]>;
  done: number;
  total: number;
  listeners: Set<ScanProgressFn>;
};

// 뷰 언마운트 후에도 살아남는 모듈 레벨 캐시 — 키=기간, 일지 수(count)로 신선도 판정.
// 수가 달라지면 stale: 뷰는 이전 결과를 먼저 그리고 뒤에서 재스캔한다 (stale-while-revalidate)
const cache = new Map<string, ScanEntry>();
// 진행 중 스캔 — 뷰가 이탈해도 스캔은 detached 로 계속돼 완료 후 캐시에 기록되고,
// 재진입한 뷰는 listeners 로 합류해 현재 진행률부터 이어서 받는다
const inflight = new Map<string, InflightScan>();
// 재발행은 기존 날짜를 덮어써 count 가 그대로라, 발행 완료 시 세대를 올려 전체 무효화한다.
// 구세대에서 시작된 스캔은 결과를 캐시에 쓰지 않는다 (스캔 중 발행 레이스 방지)
let generation = 0;

const scanKey = (since: string, until: string): string => `${since}:${until}`;

// 앱 재시작 후 첫 진입 대기 제거용 디스크 캐시 — journal 원문이 아니라 파싱 산출물
// (날짜·Done 불릿 텍스트)만 저장. 불릿 200자 truncate + 최대 4엔트리 LRU 로 용량 보호
const DISK_KEY = 'cairn:reportsScan';
const DISK_MAX = 4;
const BULLET_MAX = 200;

type DiskEntry = { key: string; count: number; rows: PerDay[] };

function diskLoad(): DiskEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISK_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as DiskEntry[]) : [];
  } catch {
    return [];
  }
}

function diskSave(entries: DiskEntry[]): void {
  try {
    localStorage.setItem(DISK_KEY, JSON.stringify(entries.slice(0, DISK_MAX)));
  } catch {
    // quota 초과 등 — 디스크 캐시는 순수 최적화라 조용히 포기
  }
}

function diskPut(key: string, count: number, rows: PerDay[]): void {
  const entry: DiskEntry = {
    key,
    count,
    rows: rows.map((r) => ({
      date: r.date,
      bullets: r.bullets.map((b) => b.slice(0, BULLET_MAX)),
    })),
  };
  diskSave([entry, ...diskLoad().filter((e) => e.key !== key)]);
}

function diskGet(key: string): DiskEntry | undefined {
  const entries = diskLoad();
  const hit = entries.find((e) => e.key === key && Array.isArray(e.rows));
  if (!hit) return undefined;
  diskSave([hit, ...entries.filter((e) => e.key !== key)]);
  return hit;
}

export function cachedScan(since: string, until: string): ScanEntry | undefined {
  const key = scanKey(since, until);
  const hit = cache.get(key);
  if (hit) return hit;
  const disk = diskGet(key);
  if (!disk) return undefined;
  // 디스크 엔트리는 disk 플래그 — 뷰/프리페치는 즉시 그리되 백그라운드 재검증(SWR)
  const entry: ScanEntry = { count: disk.count, rows: disk.rows, disk: true };
  cache.set(key, entry);
  return entry;
}

export function invalidateReportsScan(): void {
  generation += 1;
  cache.clear();
  inflight.clear();
  try {
    localStorage.removeItem(DISK_KEY);
  } catch {
    // localStorage 불가 환경(테스트 등) 무시
  }
}

export function dailyTargets(
  pages: readonly RecentPage[],
  since: string,
  until: string,
): RecentPage[] {
  return pages.filter(
    (p) => p.category === 'daily' && p.date != null && p.date >= since && p.date <= until,
  );
}

// 같은 기간 스캔은 뷰/프리페치 어디서 시작해도 1회만 — 진행 중 스캔에 합류하면
// onProgress 가 현재 진행률을 즉시 통지받는다 (뷰 재진입 시 이어서 표시)
export function startScan(
  since: string,
  until: string,
  targets: readonly RecentPage[],
  onProgress?: ScanProgressFn,
): Promise<PerDay[]> {
  const key = scanKey(since, until);
  const running = inflight.get(key);
  if (running) {
    if (onProgress) {
      running.listeners.add(onProgress);
      onProgress(running.done, running.total);
    }
    return running.promise;
  }
  const gen = generation;
  let failed = false;
  const entry: InflightScan = {
    done: 0,
    total: targets.length,
    listeners: new Set(onProgress ? [onProgress] : []),
    promise: pool(
      targets,
      4,
      async (p: RecentPage) => {
        const date = p.date as string;
        try {
          const c = await window.cairn.pageContent(p.pageId, p.workspaceLabel);
          // 본문 조회 실패는 warning + 빈 blocks 로 돌아온다 — 완전한 결과로 캐시하면 안 됨
          if (c.warning && c.blocks.length === 0) failed = true;
          return { date, bullets: sectionBullets(c.blocks, 'done') };
        } catch {
          failed = true;
          return { date, bullets: [] as string[] };
        }
      },
      (done, total) => {
        entry.done = done;
        entry.total = total;
        for (const listener of entry.listeners) listener(done, total);
      },
    )
      .then((rows) => {
        // 일시 실패가 섞인 결과는 캐시에 남기지 않는다 — 다음 진입 때 재스캔으로 복구
        if (gen === generation && !failed) {
          cache.set(key, { count: targets.length, rows });
          diskPut(key, targets.length, rows);
        }
        return rows;
      })
      .finally(() => {
        if (inflight.get(key) === entry) inflight.delete(key);
      }),
  };
  inflight.set(key, entry);
  return entry.promise;
}

export function offScanProgress(since: string, until: string, cb: ScanProgressFn): void {
  inflight.get(scanKey(since, until))?.listeners.delete(cb);
}

// 기간별 정리에서 마지막으로 쓴 기간(일수)을 기억 — 앱 로드 프리페치가 이 기간을 함께 덥힌다
const RANGE_KEY = 'cairn:reportsRange';
const RANGE_DAYS = [7, 30, 90];

export function rememberReportsRange(days: number): void {
  try {
    localStorage.setItem(RANGE_KEY, String(days));
  } catch {
    // ignore
  }
}

function lastUsedRange(): number | null {
  try {
    const days = Number(localStorage.getItem(RANGE_KEY));
    return RANGE_DAYS.includes(days) ? days : null;
  } catch {
    return null;
  }
}

// App 이 recent 로드 직후·발행 완료 시점에 최근 사용 기간+기본 기간(월)을 미리 스캔 —
// 뷰 진입 시 스피너 없이 즉시 표시. 디스크 엔트리는 보이는 채로 재검증(SWR)
export function prefetchReportsScan(recent: RecentListResult | null): void {
  if (!recent) return;
  const until = todayLocal();
  for (const days of new Set([lastUsedRange() ?? 30, 30])) {
    const since = localDateDaysAgo(days);
    const targets = dailyTargets(recent.pages, since, until);
    if (targets.length === 0) continue;
    const entry = cachedScan(since, until);
    if (entry && entry.count === targets.length && !entry.disk) continue;
    void startScan(since, until, targets).catch(() => {});
  }
}
