import type { RecentListResult, RecentPage } from '../cairn-api';
import { pool, sectionBullets } from './blocks';
import { localDateDaysAgo, todayLocal } from './reports';

export type PerDay = { date: string; bullets: string[] };
export type ScanEntry = { count: number; rows: PerDay[] };

// 뷰 언마운트 후에도 살아남는 모듈 레벨 캐시 — 키=기간, 일지 수(count)로 신선도 판정.
// 수가 달라지면 stale: 뷰는 이전 결과를 먼저 그리고 뒤에서 재스캔한다 (stale-while-revalidate)
const cache = new Map<string, ScanEntry>();
const inflight = new Map<string, Promise<PerDay[]>>();
// 재발행은 기존 날짜를 덮어써 count 가 그대로라, 발행 완료 시 세대를 올려 전체 무효화한다.
// 구세대에서 시작된 스캔은 결과를 캐시에 쓰지 않는다 (스캔 중 발행 레이스 방지)
let generation = 0;

const scanKey = (since: string, until: string): string => `${since}:${until}`;

export function cachedScan(since: string, until: string): ScanEntry | undefined {
  return cache.get(scanKey(since, until));
}

export function invalidateReportsScan(): void {
  generation += 1;
  cache.clear();
  inflight.clear();
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

// 같은 기간 스캔은 뷰/프리페치 어디서 시작해도 1회만 — 진행 콜백은 최초 시작자만 받는다
export function startScan(
  since: string,
  until: string,
  targets: readonly RecentPage[],
  onProgress?: (done: number, total: number) => void,
): Promise<PerDay[]> {
  const key = scanKey(since, until);
  const running = inflight.get(key);
  if (running) return running;
  const gen = generation;
  let failed = false;
  const scan = pool(
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
    onProgress,
  )
    .then((rows) => {
      // 일시 실패가 섞인 결과는 캐시에 남기지 않는다 — 다음 진입 때 재스캔으로 복구
      if (gen === generation && !failed) cache.set(key, { count: targets.length, rows });
      return rows;
    })
    .finally(() => {
      if (inflight.get(key) === scan) inflight.delete(key);
    });
  inflight.set(key, scan);
  return scan;
}

// App 이 idle·발행 완료 시점에 기본 기간(월)을 미리 스캔 — 뷰 진입 시 스피너 없이 즉시 표시
export function prefetchReportsScan(recent: RecentListResult | null): void {
  if (!recent) return;
  const since = localDateDaysAgo(30);
  const until = todayLocal();
  const targets = dailyTargets(recent.pages, since, until);
  if (targets.length === 0) return;
  const entry = cachedScan(since, until);
  if (entry && entry.count === targets.length) return;
  void startScan(since, until, targets).catch(() => {});
}
