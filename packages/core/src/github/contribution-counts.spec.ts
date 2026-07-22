import { describe, expect, it } from 'vitest';
import { unionContributionCounts } from './github-collector.service.js';

describe('unionContributionCounts', () => {
  it('다계정을 날짜별 최댓값으로 합친다 — 한 계정이라도 활동이면 그 날은 유지', () => {
    const a = new Map([
      ['2026-07-07', 0],
      ['2026-07-08', 2],
    ]);
    const b = new Map([
      ['2026-07-07', 5],
      ['2026-07-08', 0],
    ]);
    const union = unionContributionCounts([a, b]);
    expect(union?.get('2026-07-07')).toBe(5);
    expect(union?.get('2026-07-08')).toBe(2);
  });

  it('조회 실패 계정(null)은 무시하고 나머지를 합친다', () => {
    const a = new Map([['2026-07-07', 1]]);
    expect(unionContributionCounts([null, a])?.get('2026-07-07')).toBe(1);
  });

  it('fail-open: 전부 null(또는 입력 없음)이면 null', () => {
    expect(unionContributionCounts([null, null])).toBeNull();
    expect(unionContributionCounts([])).toBeNull();
  });
});
