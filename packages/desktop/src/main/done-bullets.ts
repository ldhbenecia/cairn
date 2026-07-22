import type { SimpleBlock } from './notion-client';

// 타입만 import(런타임 erase)라 이 모듈은 heavy 의존이 없다 — 순수 로직이라 단위 테스트 가능

const blockText = (b: SimpleBlock): string =>
  b.rich
    .map((s) => s.text)
    .join('')
    .trim();

// 렌더러 sectionBullets(blocks.ts)와 동일 계약 — 발행기가 쓰는 고정 영어 헤딩('Done') 아래
// 불릿만 뽑는다. 프로젝트 뷰 스캔 페이로드를 Done 불릿만으로 줄이려 메인에서 추출한다
// (전체 blocks 를 IPC 로 넘기지 않음). 헤딩 계약이 바뀌면 양쪽을 함께 고친다
export function doneBullets(blocks: SimpleBlock[]): string[] {
  const start = blocks.findIndex(
    (b) => b.type === 'heading_2' && blockText(b).toLowerCase() === 'done',
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
