// Done/Share 섹션 불릿 추출은 메인(done-bullets.ts)과 공유 — shared/ 에 단일 구현
export { blockText, sectionBullets } from '../../../shared/section-bullets';

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
