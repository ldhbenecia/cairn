import { describe, expect, it } from 'vitest';
import {
  MAX_MEMO_CHARS,
  MAX_MEMOS_PER_DAY,
  dropForbiddenMemos,
  memoTextsForDate,
  parseMemosFile,
} from './memo-file.js';

describe('parseMemosFile', () => {
  it('정상 파일을 날짜별 항목으로 파싱한다', () => {
    const raw = JSON.stringify({
      '2026-07-12': [{ text: '온보딩 플로우 리뷰', at: '2026-07-12T02:00:00.000Z' }],
    });
    expect(parseMemosFile(raw)).toEqual({
      '2026-07-12': [{ text: '온보딩 플로우 리뷰', at: '2026-07-12T02:00:00.000Z' }],
    });
  });

  it('깨진 JSON·잘못된 형태는 빈 객체', () => {
    expect(parseMemosFile('not json')).toEqual({});
    expect(parseMemosFile('[]')).toEqual({});
    expect(parseMemosFile('null')).toEqual({});
  });

  it('text 없는 항목·배열 아닌 값은 건너뛴다', () => {
    const raw = JSON.stringify({
      '2026-07-12': [{ text: 'ok' }, { at: 'x' }, 'plain', null],
      '2026-07-11': 'not-array',
    });
    expect(parseMemosFile(raw)).toEqual({ '2026-07-12': [{ text: 'ok' }] });
  });
});

describe('memoTextsForDate', () => {
  it('해당 날짜만 trim 해서 돌려주고 빈 항목은 거른다', () => {
    const file = {
      '2026-07-12': [{ text: '  a  ' }, { text: '   ' }, { text: 'b' }],
      '2026-07-11': [{ text: 'other' }],
    };
    expect(memoTextsForDate(file, '2026-07-12')).toEqual(['a', 'b']);
    expect(memoTextsForDate(file, '2026-07-10')).toEqual([]);
  });

  it('항목 수 상한을 적용하고, 길이 초과는 자르지 않고 스킵한다', () => {
    // truncate 는 토큰·이메일을 반토막 내 egress 패턴 매칭을 피해갈 수 있어 스킵이 정책
    const long = 'x'.repeat(MAX_MEMO_CHARS + 1);
    const file = {
      '2026-07-12': [
        { text: long },
        ...Array.from({ length: MAX_MEMOS_PER_DAY + 5 }, (_, i) => ({ text: `m${i}` })),
      ],
    };
    const out = memoTextsForDate(file, '2026-07-12');
    expect(out).toHaveLength(MAX_MEMOS_PER_DAY);
    expect(out[0]).toBe('m0');
    expect(out).not.toContain(long);
  });
});

describe('dropForbiddenMemos', () => {
  it('금지 패턴이 섞인 항목만 drop 하고 나머지는 유지한다', () => {
    const { kept, dropped } = dropForbiddenMemos([
      '정상 메모',
      '경로 유출 /Users/someone/secret',
      'someone@example.com 에게 공유',
      '토큰 ghp_0123456789012345678901234567890123',
    ]);
    expect(kept).toEqual(['정상 메모']);
    expect(dropped).toBe(3);
  });
});
