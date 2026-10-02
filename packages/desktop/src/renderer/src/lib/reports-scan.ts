import type { RecentListResult, RecentPage } from '../../../shared/ipc-types';
import { addDays, localDateDaysAgo, todayLocal } from './reports';
import { pool } from '../../../shared/pool';

export type PerDay = { date: string; bullets: string[] };

// 오늘 포함 최근 365일 — 축·그리드는 항상 이 전체를 그림
export const REPORTS_RANGE_DAYS = 365;
// 진입 시 최근 청크만 읽고 가로 스크롤이 경계에 근접하면 이전 청크를 추가 스캔
export const REPORTS_CHUNK_DAYS = 90;

export function reportsRange(): { since: string; until: string } {
  return { since: localDateDaysAgo(REPORTS_RANGE_DAYS - 1), until: todayLocal() };
}

type ScanProgressFn = (done: number, total: number) => void;

type InflightScan = {
  promise: Promise<PerDay[]>;
  done: number;
  total: number;
  listeners: Set<ScanProgressFn>;
};

// 페이지 단위 세션 캐시(메모리 전용, 키=pageId) — 구간 결과는 여기서 동기 조립하고 미캐시 페이지만
// IPC 로 읽어 스크롤 왕복·재진입·청크 중첩에도 같은 페이지를 두 번 안 읽음
type PageEntry = { date: string; bullets: string[] };

const pageCache = new Map<string, PageEntry>();
// 진행 중 스캔 — 뷰가 이탈해도 detached 로 계속돼 캐시에 기록되고, 재진입한 뷰는 listeners 로 합류
const inflight = new Map<string, InflightScan>();
// 발행 무효화 시 세대 증가 — 무효화 전에 시작된 읽기가 evict 된 페이지를 구내용으로 되살리지 않게
// fetch 시작 세대가 다르면 캐시에 안 씀
let generation = 0;

const scanKey = (since: string, until: string): string => `${since}:${until}`;

// 발행이 만든·덮어쓴 페이지만 evict 해 다음 스캔이 그것만 다시 읽음 (신규는 자연히 스캔, 사라진 건 prefetch 가 정리)
// 인자 생략 시 전체 리셋(테스트·수동 초기화), null 은 evict 대상 없음
export function invalidateReportsScan(publishedPageId?: string | null): void {
  generation += 1;
  inflight.clear();
  if (publishedPageId === undefined) pageCache.clear();
  else if (publishedPageId !== null) pageCache.delete(publishedPageId);
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

// 오늘 포함 최근 90일, 그 창에 일지가 없으면 일지가 나오는 청크까지 90일씩 확장 — 빈 상태 오표시 방지
// 뷰와 프리페치가 같은 경계를 써야 스캔 키가 일치해 in-flight 합류
export function initialLoadedSince(pages: readonly RecentPage[]): string {
  const { since, until } = reportsRange();
  let start = localDateDaysAgo(REPORTS_CHUNK_DAYS - 1);
  while (start > since && dailyTargets(pages, start, until).length === 0) {
    const prev = addDays(start, -REPORTS_CHUNK_DAYS);
    start = prev < since ? since : prev;
  }
  return start;
}

// rows 는 캐시된 페이지만(targets 순서), missing 은 미캐시 수 — 뷰는 rows 로 먼저 그리고 스캔 완료 시 갱신
export function assembleCached(targets: readonly RecentPage[]): {
  rows: PerDay[];
  missing: number;
} {
  const rows: PerDay[] = [];
  let missing = 0;
  for (const p of targets) {
    const e = pageCache.get(p.pageId);
    if (e) rows.push({ date: p.date as string, bullets: e.bullets });
    else missing += 1;
  }
  return { rows, missing };
}

// 같은 구간 스캔은 뷰·프리페치 어디서 시작해도 1회만 — 합류하면 onProgress 가 현재 진행률을 즉시 받음
// 결과는 시작 시점 캐시 스냅숏 + 새 읽기를 targets 순서로 조립
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
  const have = new Map<string, PerDay>();
  const missing: RecentPage[] = [];
  for (const p of targets) {
    const e = pageCache.get(p.pageId);
    if (e) have.set(p.pageId, { date: p.date as string, bullets: e.bullets });
    else missing.push(p);
  }
  // 최신 날짜부터 — 스트리밍 렌더 시 화면에 보이는 최근 구간이 먼저 채워짐
  missing.sort((a, b) => (b.date as string).localeCompare(a.date as string));
  const assemble = (fetched: ReadonlyMap<string, PerDay>): PerDay[] =>
    targets.map(
      (p) => have.get(p.pageId) ?? fetched.get(p.pageId) ?? { date: p.date as string, bullets: [] },
    );
  if (missing.length === 0) {
    onProgress?.(targets.length, targets.length);
    return Promise.resolve(assemble(new Map()));
  }
  const cachedCount = targets.length - missing.length;
  const fetched = new Map<string, PerDay>();
  const entry: InflightScan = {
    done: cachedCount,
    total: targets.length,
    listeners: new Set(onProgress ? [onProgress] : []),
    promise: pool(
      missing,
      8,
      async (p: RecentPage) => {
        const date = p.date as string;
        const gen = generation;
        try {
          // Done 불릿만 받아 IPC 페이로드 최소화 — date·category 를 넘겨 로컬 journal 이 있으면 메인이 로컬을 읽음
          const [r] = await window.cairn.reportsDone([
            {
              pageId: p.pageId,
              workspaceLabel: p.workspaceLabel,
              date: p.date,
              category: p.category,
            },
          ]);
          const failed = !r || r.failed;
          const bullets = failed ? [] : r.bullets;
          // 조회 실패(warning + 빈 blocks)는 캐시에 안 넣음 — 빈 채로 고착 방지, 다음 스캔 재시도
          if (!failed && gen === generation) pageCache.set(p.pageId, { date, bullets });
          fetched.set(p.pageId, { date, bullets });
        } catch {
          fetched.set(p.pageId, { date, bullets: [] });
        }
      },
      (done) => {
        entry.done = cachedCount + done;
        for (const listener of entry.listeners) listener(entry.done, entry.total);
      },
    )
      .then(() => assemble(fetched))
      .finally(() => {
        if (inflight.get(key) === entry) inflight.delete(key);
      }),
  };
  inflight.set(key, entry);
  if (cachedCount > 0 && onProgress) onProgress(entry.done, entry.total);
  return entry.promise;
}

export function offScanProgress(since: string, until: string, cb: ScanProgressFn): void {
  inflight.get(scanKey(since, until))?.listeners.delete(cb);
}

// recent 로드 직후·발행 완료 시 초기 청크를 미리 스캔해 뷰 진입 대기 제거
// recent 의 pageId 집합과 캐시 키를 대조해 사라진 페이지 정리
export function prefetchReportsScan(recent: RecentListResult | null): void {
  if (!recent) return;
  // 일부 워크스페이스 조회 실패(warnings) 땐 대조 생략 — 일시 누락에 캐시를 비우지 않게
  if (recent.warnings.length === 0) {
    const live = new Set(recent.pages.map((p) => p.pageId));
    for (const id of [...pageCache.keys()]) {
      if (!live.has(id)) pageCache.delete(id);
    }
  }
  const { until } = reportsRange();
  const start = initialLoadedSince(recent.pages);
  const targets = dailyTargets(recent.pages, start, until);
  if (targets.length === 0 || assembleCached(targets).missing === 0) return;
  void startScan(start, until, targets).catch(() => {});
}
