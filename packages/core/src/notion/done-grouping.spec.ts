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
});
