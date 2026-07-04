import { describe, expect, it } from 'vitest';
import { buildDoneBlocks } from './notion-publisher.service.js';

interface RichInner {
  rich_text: { text: { content: string } }[];
}
const typeOf = (b: unknown): string => (b as { type: string }).type;
const textOf = (b: unknown): string => {
  const inner = (b as Record<string, unknown>)[typeOf(b)] as RichInner;
  return inner.rich_text[0]!.text.content;
};

describe('buildDoneBlocks', () => {
  it('groups by [Account] prefix into heading_3 subsections, stripping the prefix', () => {
    const blocks = buildDoneBlocks([
      '[Work] team-api — fix quiz chunking',
      '[Personal] cairn — markdown export',
      '[Work] team-api — channel history',
    ]);
    expect(blocks.map(typeOf)).toEqual([
      'heading_3',
      'bulleted_list_item',
      'bulleted_list_item',
      'heading_3',
      'bulleted_list_item',
    ]);
    expect(textOf(blocks[0])).toBe('Work');
    expect(textOf(blocks[1])).toBe('team-api — fix quiz chunking');
    expect(textOf(blocks[3])).toBe('Personal');
  });

  it('stays flat (no headings) when there are no account prefixes', () => {
    const blocks = buildDoneBlocks(['cairn — a', 'cairn — b']);
    expect(blocks.map(typeOf)).toEqual(['bulleted_list_item', 'bulleted_list_item']);
  });

  it('renders a placeholder when empty', () => {
    expect(buildDoneBlocks([]).map(typeOf)).toEqual(['paragraph']);
  });

  it('with 2+ configured accounts, shows every account heading and None for empty ones', () => {
    const blocks = buildDoneBlocks(['[Work] team-api — fix'], ['Work', 'Personal']);
    expect(blocks.map(typeOf)).toEqual([
      'heading_3',
      'bulleted_list_item',
      'heading_3',
      'paragraph',
    ]);
    expect(textOf(blocks[0])).toBe('Work');
    expect(textOf(blocks[1])).toBe('team-api — fix');
    expect(textOf(blocks[2])).toBe('Personal');
    expect(textOf(blocks[3])).toBe('None');
  });

  it('multi-account 에서 계정 라벨이 아닌 [project] 프리픽스는 가짜 계정 heading 이 되지 않는다', () => {
    const blocks = buildDoneBlocks(
      ['[Work] team-api — fix', '[cairn] streak 계산 수정'],
      ['Work', 'Personal'],
    );
    expect(blocks.map(typeOf)).toEqual([
      'bulleted_list_item', // [cairn] — 프리픽스 유지한 채 계정 섹션 밖 평문 bullet
      'heading_3',
      'bulleted_list_item',
      'heading_3',
      'paragraph',
    ]);
    expect(textOf(blocks[0])).toBe('[cairn] streak 계산 수정');
    expect(textOf(blocks[1])).toBe('Work');
  });
});
