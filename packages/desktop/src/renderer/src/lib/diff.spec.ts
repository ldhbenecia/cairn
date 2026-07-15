import { describe, expect, it } from 'vitest';
import { diffLines } from './diff';

describe('diffLines', () => {
  it('추가·삭제·동일 라인을 구분한다', () => {
    const out = diffLines('a\nb\nc', 'a\nx\nc');
    expect(out).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'x' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('동일 입력이면 전부 same', () => {
    expect(diffLines('a\nb', 'a\nb').every((l) => l.type === 'same')).toBe(true);
  });

  it('빈쪽 입력은 전부 add/del', () => {
    expect(diffLines('', 'a\nb').map((l) => l.type)).toEqual(['del', 'add', 'add']);
    expect(diffLines('a', '').map((l) => l.type)).toEqual(['del', 'add']);
  });

  it('끝쪽 추가', () => {
    expect(diffLines('a\nb', 'a\nb\nc').map((l) => l.type)).toEqual(['same', 'same', 'add']);
  });
});
