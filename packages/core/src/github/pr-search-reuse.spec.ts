import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { GithubApiClient, type SearchPrItem } from './github-api.client.js';
import { canReusePrSearch, isPrSliceComplete, sliceUpdatedSince } from './pr-search-reuse.js';

const D1 = '2026-06-20T00:00:00Z';
const D2 = '2026-06-25T00:00:00Z';
const D3 = '2026-06-30T00:00:00Z';

function item(updatedAt: string): SearchPrItem {
  return { updatedAt } as SearchPrItem;
}

describe('canReusePrSearch', () => {
  it('reuses when requested lower bound is same or newer than cached', () => {
    expect(canReusePrSearch(D1, D2)).toBe(true);
    expect(canReusePrSearch(D1, D1)).toBe(true);
  });

  it('does not reuse when requested lower bound is older (wider) than cached', () => {
    expect(canReusePrSearch(D2, D1)).toBe(false);
  });

  it('compares instants, not strings (offset-normalized)', () => {
    expect(canReusePrSearch('2026-06-20T09:00:00+09:00', D1)).toBe(true);
  });
});

describe('sliceUpdatedSince', () => {
  it('keeps items with updatedAt >= lower bound (boundary inclusive)', () => {
    const items = [item(D3), item(D2), item(D1)];
    expect(sliceUpdatedSince(items, D2)).toEqual([item(D3), item(D2)]);
  });

  it('returns all items when bound is older than everything', () => {
    const items = [item(D3), item(D2)];
    expect(sliceUpdatedSince(items, D1)).toEqual(items);
  });
});

describe('isPrSliceComplete', () => {
  it('complete when the cached fetch was not truncated', () => {
    expect(isPrSliceComplete(false, D1, D2)).toBe(true);
  });

  it('truncated but requested bound strictly newer than oldest returned → complete', () => {
    expect(isPrSliceComplete(true, D1, D2)).toBe(true);
  });

  it('truncated and requested bound at/below oldest returned → not provably complete', () => {
    // == oldest 는 truncation 경계의 동률(updated_at tie) 가능성 때문에 완전 보장 불가
    expect(isPrSliceComplete(true, D2, D2)).toBe(false);
    expect(isPrSliceComplete(true, D2, D1)).toBe(false);
  });

  it('truncated with empty result → complete (nothing below to miss)', () => {
    expect(isPrSliceComplete(true, undefined, D1)).toBe(true);
  });
});

describe('GithubApiClient.searchPrsUpdatedSince cache', () => {
  function makeClient() {
    const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
    const client = new GithubApiClient(logger);
    const fetchSpy = vi.spyOn(
      client as unknown as {
        fetchSearchPrs: (
          token: string,
          query: string,
        ) => Promise<{ items: SearchPrItem[]; truncated: boolean }>;
      },
      'fetchSearchPrs',
    );
    return { client, fetchSpy, logger };
  }

  it('serves a narrower lower bound from the wider cached fetch (filtered)', async () => {
    const { client, fetchSpy } = makeClient();
    fetchSpy.mockResolvedValue({ items: [item(D3), item(D2), item(D1)], truncated: false });

    const wide = await client.searchPrsUpdatedSince('tok', 'involves:@me', D1);
    const narrow = await client.searchPrsUpdatedSince('tok', 'involves:@me', D2);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('tok', `involves:@me updated:>=${D1}`);
    expect(wide).toHaveLength(3);
    expect(narrow).toEqual([item(D3), item(D2)]);
  });

  it('concurrent callers await the same in-flight fetch (no duplicate search)', async () => {
    const { client, fetchSpy } = makeClient();
    let resolveFetch!: (r: { items: SearchPrItem[]; truncated: boolean }) => void;
    fetchSpy.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));

    const p1 = client.searchPrsUpdatedSince('tok', 'involves:@me', D1);
    const p2 = client.searchPrsUpdatedSince('tok', 'involves:@me', D2);
    const p3 = client.searchPrsUpdatedSince('tok', 'involves:@me', D3);
    resolveFetch({ items: [item(D3), item(D2), item(D1)], truncated: false });

    expect(await p1).toHaveLength(3);
    expect(await p2).toHaveLength(2);
    expect(await p3).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('a wider request re-fetches and replaces the cache entry', async () => {
    const { client, fetchSpy } = makeClient();
    fetchSpy
      .mockResolvedValueOnce({ items: [item(D3)], truncated: false })
      .mockResolvedValueOnce({ items: [item(D3), item(D2), item(D1)], truncated: false });

    await client.searchPrsUpdatedSince('tok', 'involves:@me', D2);
    const wide = await client.searchPrsUpdatedSince('tok', 'involves:@me', D1);
    const narrowAgain = await client.searchPrsUpdatedSince('tok', 'involves:@me', D3);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(wide).toHaveLength(3);
    expect(narrowAgain).toEqual([item(D3)]);
  });

  it('caches per (token, baseQuery) — different token or query fetches separately', async () => {
    const { client, fetchSpy } = makeClient();
    fetchSpy.mockResolvedValue({ items: [], truncated: false });

    await client.searchPrsUpdatedSince('tok-a', 'involves:@me', D1);
    await client.searchPrsUpdatedSince('tok-b', 'involves:@me', D1);
    await client.searchPrsUpdatedSince('tok-a', 'author:@me', D1);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('serves truncated cache for a narrower bound (identical to a fresh top-1000 search)', async () => {
    const { client, fetchSpy } = makeClient();
    fetchSpy.mockResolvedValue({ items: [item(D3), item(D2)], truncated: true });

    await client.searchPrsUpdatedSince('tok', 'involves:@me', D1);
    const served = await client.searchPrsUpdatedSince('tok', 'involves:@me', D2);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(served).toEqual([item(D3), item(D2)]);
  });

  it('evicts a failed fetch so the next call retries', async () => {
    const { client, fetchSpy } = makeClient();
    fetchSpy
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ items: [item(D2)], truncated: false });

    await expect(client.searchPrsUpdatedSince('tok', 'involves:@me', D1)).rejects.toThrow('boom');
    await expect(client.searchPrsUpdatedSince('tok', 'involves:@me', D1)).resolves.toEqual([
      item(D2),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
