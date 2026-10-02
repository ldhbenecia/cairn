import type { SimpleBlock } from './notion-client';
import { sectionBullets } from '../shared/section-bullets';

// 렌더러(lib/blocks.ts)와 공유하는 shared 구현 재사용 — 타입만 import 해 단위 테스트 가능
export function doneBullets(blocks: SimpleBlock[]): string[] {
  return sectionBullets(blocks, 'Done');
}
