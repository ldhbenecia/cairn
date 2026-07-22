import { describe, expect, it } from 'vitest';
import { gateBackfillDates } from './orchestrator.service.js';

describe('gateBackfillDates', () => {
  it('활동 0으로 확인된 날짜를 백필에서 제외한다', () => {
    const counts = new Map([
      ['2026-07-07', 0],
      ['2026-07-08', 3],
      ['2026-07-09', 0],
    ]);
    expect(gateBackfillDates(['2026-07-07', '2026-07-08', '2026-07-09'], counts)).toEqual([
      '2026-07-08',
    ]);
  });

  it('fail-open: 캘린더 null(조회 실패)이면 전 날짜를 그대로 유지한다', () => {
    expect(gateBackfillDates(['2026-07-07', '2026-07-08'], null)).toEqual([
      '2026-07-07',
      '2026-07-08',
    ]);
  });

  it('캘린더에 없는 날짜(범위 밖 등)는 미상으로 보고 유지한다', () => {
    const counts = new Map([['2026-07-08', 0]]);
    expect(gateBackfillDates(['2026-07-07', '2026-07-08'], counts)).toEqual(['2026-07-07']);
  });
});
