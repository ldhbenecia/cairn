import { describe, expect, it, vi } from 'vitest';
import { appendChildrenInBatches, NOTION_MAX_CHILDREN } from './notion-page-create.js';

type AppendArgs = { block_id: string; children: unknown[] };

describe('appendChildrenInBatches', () => {
  it('appends nothing for empty input', async () => {
    const append = vi.fn((_args: AppendArgs) => Promise.resolve({}));
    const client = { blocks: { children: { append } } } as never;
    await appendChildrenInBatches(client, 'p', []);
    expect(append).not.toHaveBeenCalled();
  });

  it('splits >100 blocks into ≤100 batches preserving order', async () => {
    const append = vi.fn((_args: AppendArgs) => Promise.resolve({}));
    const client = { blocks: { children: { append } } } as never;
    const blocks = Array.from({ length: 250 }, (_, i) => ({ i }));

    await appendChildrenInBatches(client, 'page-1', blocks);

    expect(NOTION_MAX_CHILDREN).toBe(100);
    expect(append).toHaveBeenCalledTimes(3);
    const sizes = append.mock.calls.map((c) => c[0].children.length);
    expect(sizes).toEqual([100, 100, 50]);
    const firstBatch = append.mock.calls[0]![0].children as { i: number }[];
    expect(firstBatch[0]).toEqual({ i: 0 });
    expect(firstBatch[99]).toEqual({ i: 99 });
  });
});
