import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageContent, RecentListResult, RecentPage } from '../cairn-api';
import { localDateDaysAgo, todayLocal } from './reports';
import {
  cachedScan,
  invalidateReportsScan,
  offScanProgress,
  prefetchReportsScan,
  rememberReportsRange,
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

const doneContent = (text: string): PageContent => ({
  blocks: [
    { id: 'h', type: 'heading_2', rich: [{ text: 'Done' }] },
    { id: 'b', type: 'bulleted_list_item', rich: [{ text }] },
  ],
});

const pageContent = vi.fn<(pageId: string, ws: string) => Promise<PageContent>>();

const store = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const diskEntries = (): { key: string; count: number; rows: { bullets: string[] }[] }[] =>
  JSON.parse(store.get('cairn:reportsScan') ?? '[]') as ReturnType<typeof diskEntries>;

beforeEach(() => {
  vi.stubGlobal('window', { cairn: { pageContent } });
  vi.stubGlobal('localStorage', fakeLocalStorage);
  pageContent.mockReset();
  invalidateReportsScan();
  store.clear();
});

describe('startScan 캐시', () => {
  it('성공 스캔은 캐시되고 같은 기간 재조회에 재사용된다', async () => {
    pageContent.mockResolvedValue(doneContent('작업'));
    const rows = await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(rows).toEqual([{ date: '2026-07-01', bullets: ['작업'] }]);
    expect(cachedScan('2026-07-01', '2026-07-02')).toEqual({ count: 1, rows });
  });

  it('reject 된 페이지가 섞인 결과는 캐시에 남지 않는다 — 재시도로 복구 가능', async () => {
    pageContent.mockRejectedValueOnce(new Error('network'));
    const rows = await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(rows).toEqual([{ date: '2026-07-01', bullets: [] }]);
    expect(cachedScan('2026-07-01', '2026-07-02')).toBeUndefined();

    pageContent.mockResolvedValue(doneContent('작업'));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(cachedScan('2026-07-01', '2026-07-02')?.rows[0]?.bullets).toEqual(['작업']);
  });

  it('warning + 빈 blocks(본문 조회 실패)도 실패로 취급해 캐시하지 않는다', async () => {
    pageContent.mockResolvedValue({ blocks: [], warning: 'token 없음' });
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(cachedScan('2026-07-01', '2026-07-02')).toBeUndefined();
  });

  it('같은 기간 동시 시작은 in-flight 스캔을 재사용한다', async () => {
    pageContent.mockResolvedValue(doneContent('작업'));
    const a = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    const b = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(b).toBe(a);
    await a;
    expect(pageContent).toHaveBeenCalledTimes(1);
  });
});

describe('진행 구독', () => {
  it('진행 중 스캔 재합류 — 현재 진행률을 즉시 받고 이후 진행도 구독한다', async () => {
    let release: (c: PageContent) => void = () => {};
    pageContent
      .mockResolvedValueOnce(doneContent('a'))
      .mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const targets = [page('2026-07-01'), page('2026-07-02')];
    const first = startScan('2026-07-01', '2026-07-02', targets);
    await new Promise((r) => setTimeout(r, 0));

    // 뷰 재진입 시나리오 — 이미 완료된 1건이 합류 즉시 통지된다
    const seen: [number, number][] = [];
    const joined = startScan('2026-07-01', '2026-07-02', targets, (d, t) => seen.push([d, t]));
    expect(joined).toBe(first);
    expect(seen).toEqual([[1, 2]]);

    release(doneContent('b'));
    await joined;
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('offScanProgress — 구독 해제 후엔 진행 통지를 받지 않는다', async () => {
    let release: (c: PageContent) => void = () => {};
    pageContent.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const seen: number[] = [];
    const cb = (done: number): number => seen.push(done);
    const scan = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')], cb);
    offScanProgress('2026-07-01', '2026-07-02', cb);
    release(doneContent('작업'));
    await scan;
    expect(seen).toEqual([]);
  });
});

describe('디스크 캐시 (localStorage)', () => {
  it('성공 스캔은 디스크에도 직렬화 — 불릿은 200자 truncate', async () => {
    pageContent.mockResolvedValue(doneContent('가'.repeat(300)));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    const disk = diskEntries();
    expect(disk).toHaveLength(1);
    expect(disk[0]?.key).toBe('2026-07-01:2026-07-02');
    expect(disk[0]?.count).toBe(1);
    expect(disk[0]?.rows[0]?.bullets[0]).toHaveLength(200);
    // 메모리 캐시는 원문 유지 — truncate 는 디스크 사본에만
    expect(cachedScan('2026-07-01', '2026-07-02')?.rows[0]?.bullets[0]).toHaveLength(300);
  });

  it('앱 재시작(모듈 초기화) 후 디스크에서 즉시 복원 — disk 플래그로 재검증 대상 표시', async () => {
    pageContent.mockResolvedValue(doneContent('작업'));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);

    vi.resetModules();
    const fresh = await import('./reports-scan');
    const entry = fresh.cachedScan('2026-07-01', '2026-07-02');
    expect(entry?.disk).toBe(true);
    expect(entry?.count).toBe(1);
    expect(entry?.rows[0]?.bullets).toEqual(['작업']);
  });

  it('최대 4엔트리 LRU — 가장 오래된 기간이 밀려난다', async () => {
    pageContent.mockResolvedValue(doneContent('작업'));
    for (let i = 1; i <= 5; i++) {
      const d = `2026-07-0${i}`;
      await startScan(d, d, [page(d)]);
    }
    expect(diskEntries().map((e) => e.key)).toEqual([
      '2026-07-05:2026-07-05',
      '2026-07-04:2026-07-04',
      '2026-07-03:2026-07-03',
      '2026-07-02:2026-07-02',
    ]);
  });

  it('invalidateReportsScan 은 디스크 캐시도 비운다', async () => {
    pageContent.mockResolvedValue(doneContent('작업'));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    invalidateReportsScan();
    expect(store.get('cairn:reportsScan')).toBeUndefined();
    expect(cachedScan('2026-07-01', '2026-07-02')).toBeUndefined();
  });
});

describe('prefetchReportsScan', () => {
  it('최근 사용 기간 + 기본 기간(월)을 함께 덥힌다', async () => {
    rememberReportsRange(90);
    pageContent.mockResolvedValue(doneContent('작업'));
    const until = todayLocal();
    const recent = {
      pages: [page(localDateDaysAgo(60)), page(localDateDaysAgo(5))],
    } as RecentListResult;
    prefetchReportsScan(recent);
    await vi.waitFor(() => {
      expect(cachedScan(localDateDaysAgo(90), until)?.count).toBe(2);
      expect(cachedScan(localDateDaysAgo(30), until)?.count).toBe(1);
    });
  });
});
