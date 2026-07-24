import type { SimpleBlock } from './notion-client';
import { sectionBullets } from '../shared/section-bullets';

// Done 섹션 불릿 추출 — 렌더러(lib/blocks.ts)와 공유하는 shared 구현 재사용(이중 구현 제거).
// 타입만 import(런타임 erase)·shared 도 heavy 의존 없어 순수 로직이라 단위 테스트 가능
export function doneBullets(blocks: SimpleBlock[]): string[] {
  return sectionBullets(blocks, 'Done');
}
