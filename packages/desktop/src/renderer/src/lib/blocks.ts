import type { SimpleBlock } from '../cairn-api';

export const blockText = (b: SimpleBlock): string =>
  b.rich
    .map((s) => s.text)
    .join('')
    .trim();

// 발행기가 쓰는 섹션 헤딩(Share·Done 등)은 고정 영어라 lowercase 로 비교
export function sectionBullets(blocks: SimpleBlock[], section: string): string[] {
  const target = section.toLowerCase();
  const start = blocks.findIndex(
    (b) => b.type === 'heading_2' && blockText(b).toLowerCase() === target,
  );
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type === 'heading_1' || b.type === 'heading_2') break;
    if (b.type === 'bulleted_list_item') {
      const text = blockText(b);
      if (text) out.push(text);
    }
  }
  return out;
}

// Notion API rate limit 회피용 동시성 캡 (진행 콜백 지원)
export async function pool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
      done += 1;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
