import { describe, expect, it } from 'vitest';
import { hourHistogram } from './notion-publisher.service.js';

describe('hourHistogram', () => {
  it('counts timestamps into their local hour bucket', () => {
    // getHours() 는 머신 로컬 TZ 기준 — 기대값도 동일 방식으로 계산해 TZ 무관 결정적 테스트
    const stamps = ['2026-05-09T03:00:00Z', '2026-05-09T03:30:00Z', '2026-05-09T21:00:00+09:00'];
    const expected = new Array<number>(24).fill(0);
    for (const s of stamps) expected[new Date(s).getHours()]! += 1;

    expect(hourHistogram(stamps)).toEqual(expected);
    expect(hourHistogram(stamps).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('returns all-zero for empty input', () => {
    expect(hourHistogram([])).toEqual(new Array<number>(24).fill(0));
  });

  it('always yields 24 buckets', () => {
    expect(hourHistogram(['2026-05-09T12:00:00Z'])).toHaveLength(24);
  });
});
