// 렌더러(lib/blocks.ts)·메인(done-bullets.ts)이 공유하는 Done/Share 섹션 불릿 추출 — 이중 구현
// 제거. 최소 구조 타입으로 받아 양 프로세스의 SimpleBlock 이 그대로 assignable
type Block = { type: string; rich: readonly { text: string }[] };

export const blockText = (b: Block): string =>
  b.rich
    .map((s) => s.text)
    .join('')
    .trim();

// 발행기가 쓰는 섹션 헤딩(Share·Done 등)은 고정 영어라 lowercase 로 비교
export function sectionBullets(blocks: readonly Block[], section: string): string[] {
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
