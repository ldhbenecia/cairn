import { describe, expect, it } from 'vitest';
import { paragraph, bulletItem } from './notion-blocks.js';

interface RichTextBlock {
  paragraph?: { rich_text: { text: { content: string } }[] };
  bulleted_list_item?: { rich_text: { text: { content: string } }[] };
}

describe('rich_text 2000자 청킹', () => {
  it('2000자 이하는 단일 rich_text', () => {
    const b = paragraph('a'.repeat(2000)) as RichTextBlock;
    expect(b.paragraph!.rich_text).toHaveLength(1);
  });

  it('초과분은 같은 블록 안에서 분할 — Notion validation 오류 방지', () => {
    const b = paragraph('a'.repeat(4500)) as RichTextBlock;
    const chunks = b.paragraph!.rich_text;
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.text.content.length)).toEqual([2000, 2000, 500]);
    expect(chunks.map((c) => c.text.content).join('')).toBe('a'.repeat(4500));
  });

  it('bullet 도 동일 적용 (사용자 편집 journal 재발행 방어)', () => {
    const b = bulletItem('b'.repeat(2001)) as RichTextBlock;
    expect(b.bulleted_list_item!.rich_text).toHaveLength(2);
  });
});
