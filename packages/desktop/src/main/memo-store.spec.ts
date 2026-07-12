import { describe, expect, it } from 'vitest';
import { appendMemoEntry, parseMemosFile, pruneBefore, todayLocalIsoDate } from './memo-store';

describe('todayLocalIsoDate', () => {
  it('로컬 날짜 기준 YYYY-MM-DD', () => {
    expect(todayLocalIsoDate(new Date(2026, 6, 12, 23, 59))).toBe('2026-07-12');
    expect(todayLocalIsoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('parseMemosFile', () => {
  it('정상 파일 파싱', () => {
    const raw = JSON.stringify({ '2026-07-12': [{ text: 'a', at: '2026-07-12T01:00:00.000Z' }] });
    expect(parseMemosFile(raw)).toEqual({
      '2026-07-12': [{ text: 'a', at: '2026-07-12T01:00:00.000Z' }],
    });
  });

  it('깨진 JSON·이상한 형태는 빈 객체 (캡처가 파일 하나 때문에 죽지 않게)', () => {
    expect(parseMemosFile('oops')).toEqual({});
    expect(parseMemosFile('[1,2]')).toEqual({});
    expect(parseMemosFile(JSON.stringify({ d: [{ text: 1, at: 'x' }, 'y'] }))).toEqual({});
  });
});

describe('appendMemoEntry / pruneBefore', () => {
  it('같은 날짜에 누적 append', () => {
    const one = appendMemoEntry({}, '2026-07-12', { text: 'a', at: 't1' });
    const two = appendMemoEntry(one, '2026-07-12', { text: 'b', at: 't2' });
    expect(two['2026-07-12']?.map((e) => e.text)).toEqual(['a', 'b']);
  });

  it('cutoff 이전 날짜만 정리하고 이후는 보존', () => {
    const file = {
      '2026-05-01': [{ text: 'old', at: 't' }],
      '2026-05-13': [{ text: 'kept', at: 't' }],
    };
    expect(Object.keys(pruneBefore(file, '2026-05-13'))).toEqual(['2026-05-13']);
  });
});
