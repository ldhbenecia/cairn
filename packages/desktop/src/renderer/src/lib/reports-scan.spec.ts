import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageContent, RecentPage } from '../cairn-api';
import { cachedScan, invalidateReportsScan, startScan } from './reports-scan';

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

beforeEach(() => {
  vi.stubGlobal('window', { cairn: { pageContent } });
  pageContent.mockReset();
  invalidateReportsScan();
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

describe('invalidateReportsScan', () => {
  it('캐시를 비워 재발행(count 동일) 후에도 재스캔하게 한다', async () => {
    pageContent.mockResolvedValue(doneContent('이전'));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    invalidateReportsScan();
    expect(cachedScan('2026-07-01', '2026-07-02')).toBeUndefined();

    pageContent.mockResolvedValue(doneContent('재발행'));
    await startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    expect(cachedScan('2026-07-01', '2026-07-02')?.rows[0]?.bullets).toEqual(['재발행']);
  });

  it('스캔 도중 발행(무효화)되면 구세대 결과는 캐시에 쓰이지 않는다', async () => {
    let release: (c: PageContent) => void = () => {};
    pageContent.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const stale = startScan('2026-07-01', '2026-07-02', [page('2026-07-01')]);
    invalidateReportsScan();
    release(doneContent('구버전'));
    await stale;
    expect(cachedScan('2026-07-01', '2026-07-02')).toBeUndefined();
  });
});
