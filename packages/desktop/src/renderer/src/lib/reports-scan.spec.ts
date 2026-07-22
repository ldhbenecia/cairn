import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecentListResult, RecentPage } from '../cairn-api';
import { daySpan, localDateDaysAgo, todayLocal } from './reports';
import {
  assembleCached,
  initialLoadedSince,
  invalidateReportsScan,
  offScanProgress,
  prefetchReportsScan,
  REPORTS_CHUNK_DAYS,
  REPORTS_RANGE_DAYS,
  reportsRange,
  startScan,
} from './reports-scan';

const page = (date: string): RecentPage => ({
  pageId: `id-${date}`,
  url: '',
  title: `${date} 작업 일지`,
  date,
  status: null,
  category: 'daily',
  pr: null,
  commit: null,
  hours: null,
  workspaceLabel: 'ws',
});

type DoneRef = { pageId: string; workspaceLabel: string };
type DoneResult = { pageId: string; bullets: string[]; failed: boolean };

// reportsDone(배치 API) mock — 스캔은 페이지당 1건씩 호출하므로 refs 를 그대로 결과로 매핑한다
const done =
  (bullets: string[], failed = false) =>
  (refs: DoneRef[]): Promise<DoneResult[]> =>
    Promise.resolve(refs.map((r) => ({ pageId: r.pageId, bullets, failed })));

const reportsDone = vi.fn<(refs: DoneRef[]) => Promise<DoneResult[]>>();

beforeEach(() => {
  vi.stubGlobal('window', { cairn: { reportsDone } });
  reportsDone.mockReset();
  invalidateReportsScan();
});

describe('페이지 단위 세션 캐시', () => {
  it('성공 스캔은 페이지별로 캐시 — 같은 targets 재스캔은 IPC 없이 조립된다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const targets = [page('2026-07-01')];
    const rows = await startScan('2026-07-01', '2026-07-02', targets);
    expect(rows).toEqual([{ date: '2026-07-01', bullets: ['작업'] }]);
    expect(assembleCached(targets)).toEqual({ rows, missing: 0 });

    const again = await startScan('2026-07-01', '2026-07-02', targets);
    expect(again).toEqual(rows);
    expect(reportsDone).toHaveBeenCalledTimes(1);
  });

  it('캐시에 없는 신규 페이지만 읽는다 — 청크 확장 스캔에서 히트는 호출 생략', async () => {
    reportsDone.mockImplementation(done(['작업']));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01'), page('2026-07-02')]);
    expect(reportsDone).toHaveBeenCalledTimes(2);

    const grown = [page('2026-06-01'), page('2026-07-01'), page('2026-07-02')];
    const rows = await startScan('2026-06-01', '2026-07-02', grown);
    expect(reportsDone).toHaveBeenCalledTimes(3);
    expect(reportsDone).toHaveBeenLastCalledWith([
      { pageId: 'id-2026-06-01', workspaceLabel: 'ws', date: '2026-06-01', category: 'daily' },
    ]);
    expect(rows.map((r) => r.date)).toEqual(['2026-06-01', '2026-07-01', '2026-07-02']);
  });

  it('실패 페이지만 캐시에 안 남는다 — 성공 페이지는 유지, 재시도로 복구', async () => {
    // 스캔은 최신부터 — 첫 페치(07-02)가 실패, 07-01 은 성공
    reportsDone.mockRejectedValueOnce(new Error('network')).mockImplementation(done(['작업']));
    const targets = [page('2026-07-01'), page('2026-07-02')];
    const rows = await startScan('2026-07-01', '2026-07-02', targets);
    expect(rows).toEqual([
      { date: '2026-07-01', bullets: ['작업'] },
      { date: '2026-07-02', bullets: [] },
    ]);
    expect(assembleCached(targets)).toEqual({
      rows: [{ date: '2026-07-01', bullets: ['작업'] }],
      missing: 1,
    });

    await startScan('2026-07-01', '2026-07-02', targets);
    expect(reportsDone).toHaveBeenCalledTimes(3);
    expect(assembleCached(targets).missing).toBe(0);
  });

  it('failed 결과(본문 조회 실패)도 캐시하지 않는다', async () => {
    reportsDone.mockImplementation(done([], true));
    const targets = [page('2026-07-01')];
    const rows = await startScan('2026-07-01', '2026-07-02', targets);
    expect(rows).toEqual([{ date: '2026-07-01', bullets: [] }]);
    expect(assembleCached(targets).missing).toBe(1);
  });

  it('같은 구간 동시 시작은 in-flight 스캔을 재사용한다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const a = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    const b = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(b).toBe(a);
    await a;
    expect(reportsDone).toHaveBeenCalledTimes(1);
  });
});

describe('진행 구독', () => {
  it('진행 중 스캔 재합류 — 현재 진행률을 즉시 받고 이후 진행도 구독한다', async () => {
    let release: (r: DoneResult[]) => void = () => {};
    reportsDone
      .mockImplementationOnce(done(['a']))
      .mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const targets = [page('2026-07-01'), page('2026-07-02')];
    const first = startScan('2026-07-01', '2026-07-02', targets);
    await new Promise((r) => setTimeout(r, 0));

    // 뷰 재진입 시나리오 — 이미 완료된 1건이 합류 즉시 통지된다
    const seen: [number, number][] = [];
    const joined = startScan('2026-07-01', '2026-07-02', targets, (d, t) => seen.push([d, t]));
    expect(joined).toBe(first);
    expect(seen).toEqual([[1, 2]]);

    release([{ pageId: 'id-2026-07-01', bullets: ['b'], failed: false }]);
    await joined;
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('캐시 히트는 진행률에 선반영 — done 이 캐시 수부터 시작한다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    await startScan('2026-07-01', '2026-07-01', [page('2026-07-01')]);

    const seen: [number, number][] = [];
    const targets = [page('2026-07-01'), page('2026-07-02')];
    await startScan('2026-07-01', '2026-07-02', targets, (d, t) => seen.push([d, t]));
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('offScanProgress — 구독 해제 후엔 진행 통지를 받지 않는다', async () => {
    let release: (r: DoneResult[]) => void = () => {};
    reportsDone.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const seen: number[] = [];
    const cb = (done: number): number => seen.push(done);
    const scan = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')], cb);
    offScanProgress('2026-07-01', '2026-07-02', cb);
    release([{ pageId: 'id-2026-07-01', bullets: ['작업'], failed: false }]);
    await scan;
    expect(seen).toEqual([]);
  });
});

describe('발행 무효화 (페이지 단위 evict)', () => {
  it('발행된 페이지만 evict — 나머지 캐시는 유지된다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const targets = [page('2026-07-01'), page('2026-07-02')];
    await startScan('2026-07-01', '2026-07-02', targets);

    invalidateReportsScan('id-2026-07-01');
    expect(assembleCached(targets)).toEqual({
      rows: [{ date: '2026-07-02', bullets: ['작업'] }],
      missing: 1,
    });
  });

  it('null(발행 산출 페이지 없음)은 아무 것도 evict 하지 않는다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    invalidateReportsScan(null);
    expect(assembleCached([page('2026-07-01')]).missing).toBe(0);
  });

  it('인자 없이 호출하면 전체 리셋된다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    invalidateReportsScan();
    expect(assembleCached([page('2026-07-01')]).missing).toBe(1);
  });

  it('무효화 이전에 시작된 본문 읽기는 캐시에 쓰지 않는다 (스캔 중 발행 레이스)', async () => {
    let release: (r: DoneResult[]) => void = () => {};
    reportsDone.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const scan = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    invalidateReportsScan('id-other');
    release([{ pageId: 'id-2026-07-01', bullets: ['작업'], failed: false }]);
    const rows = await scan;
    expect(rows).toEqual([{ date: '2026-07-01', bullets: ['작업'] }]);
    expect(assembleCached([page('2026-07-01')]).missing).toBe(1);
  });
});

describe('초기 로드 구간 (initialLoadedSince)', () => {
  it('기본은 오늘 포함 최근 90일 시작', () => {
    expect(initialLoadedSince([page(localDateDaysAgo(5))])).toBe(
      localDateDaysAgo(REPORTS_CHUNK_DAYS - 1),
    );
  });

  it('초기 창이 비면 일지가 나오는 청크까지 90일 단위로 확장한다', () => {
    expect(initialLoadedSince([page(localDateDaysAgo(100))])).toBe(localDateDaysAgo(179));
  });

  it('범위 내 일지가 없으면 전체 범위 시작으로 클램프된다', () => {
    const { since } = reportsRange();
    expect(initialLoadedSince([])).toBe(since);
    expect(initialLoadedSince([page(localDateDaysAgo(360))])).toBe(since);
  });
});

describe('prefetch / recent 대조', () => {
  it('고정 범위(오늘 포함 최근 365일) — 로컬 날짜 문자열 산술', () => {
    const { since, until } = reportsRange();
    expect(until).toBe(todayLocal());
    expect(since).toBe(localDateDaysAgo(REPORTS_RANGE_DAYS - 1));
    expect(daySpan(since, until)).toBe(REPORTS_RANGE_DAYS);
  });

  it('prefetchReportsScan 은 초기 청크(최근 90일)만 덥힌다 — 이전 구간은 레이지', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const inChunk = [page(localDateDaysAgo(60)), page(localDateDaysAgo(5))];
    const older = page(localDateDaysAgo(200));
    prefetchReportsScan({ pages: [older, ...inChunk], warnings: [] });
    await vi.waitFor(() => {
      expect(assembleCached(inChunk).missing).toBe(0);
    });
    expect(reportsDone).toHaveBeenCalledTimes(2);
    expect(assembleCached([older]).missing).toBe(1);
  });

  it('전부 캐시면 스캔을 시작하지 않는다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const targets = [page(localDateDaysAgo(5))];
    const { until } = reportsRange();
    await startScan(localDateDaysAgo(REPORTS_CHUNK_DAYS - 1), until, targets);
    prefetchReportsScan({ pages: targets, warnings: [] });
    expect(reportsDone).toHaveBeenCalledTimes(1);
  });

  it('recent 에서 사라진 페이지는 캐시에서 제거된다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const kept = page(localDateDaysAgo(5));
    const gone = page(localDateDaysAgo(6));
    await startScan('a', 'b', [kept, gone]);

    prefetchReportsScan({ pages: [kept], warnings: [] });
    expect(assembleCached([kept]).missing).toBe(0);
    expect(assembleCached([gone]).missing).toBe(1);
    expect(reportsDone).toHaveBeenCalledTimes(2);
  });

  it('warnings 가 있으면 대조 생략 — 일시 조회 실패로 캐시를 비우지 않는다', async () => {
    reportsDone.mockImplementation(done(['작업']));
    const kept = page(localDateDaysAgo(5));
    const missingNow = page(localDateDaysAgo(6));
    await startScan('a', 'b', [kept, missingNow]);

    prefetchReportsScan({
      pages: [kept],
      warnings: [{ code: 'fetch-failed', workspace: 'ws', kind: 'worklog', detail: 'x' }],
    } satisfies RecentListResult);
    expect(assembleCached([kept, missingNow]).missing).toBe(0);
  });
});
