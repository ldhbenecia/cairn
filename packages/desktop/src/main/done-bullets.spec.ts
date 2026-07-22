import { describe, expect, it } from 'vitest';
import { doneBullets } from './done-bullets';
import type { SimpleBlock } from './notion-client';

const b = (type: string, text = ''): SimpleBlock => ({ id: text || type, type, rich: [{ text }] });

describe('doneBullets', () => {
  it("'Done' heading_2 아래 불릿만 뽑는다", () => {
    const blocks = [
      b('heading_2', 'Share'),
      b('bulleted_list_item', '공유용'),
      b('heading_2', 'Done'),
      b('bulleted_list_item', '[repo] 작업 A'),
      b('bulleted_list_item', '[repo] 작업 B'),
    ];
    expect(doneBullets(blocks)).toEqual(['[repo] 작업 A', '[repo] 작업 B']);
  });

  it('다음 heading 에서 멈춘다', () => {
    const blocks = [
      b('heading_2', 'Done'),
      b('bulleted_list_item', '작업 A'),
      b('heading_1', 'Notes'),
      b('bulleted_list_item', '뒤 섹션'),
    ];
    expect(doneBullets(blocks)).toEqual(['작업 A']);
  });

  it("'Done' 섹션이 없으면 빈 배열", () => {
    expect(doneBullets([b('heading_2', 'Share'), b('bulleted_list_item', 'x')])).toEqual([]);
  });

  it('빈 불릿은 건너뛴다', () => {
    const blocks = [
      b('heading_2', 'Done'),
      b('bulleted_list_item', ''),
      b('bulleted_list_item', 'A'),
    ];
    expect(doneBullets(blocks)).toEqual(['A']);
  });
});
