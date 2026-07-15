import { describe, it, expect } from 'vitest';
import {
  isoWeekLabel,
  isoWeekRange,
  monthLabel,
  monthRange,
  periodRange,
  yearLabel,
  yearRange,
} from './period-range.js';

describe('isoWeekRange', () => {
  it('Wednesday 2026-04-22 → Mon 2026-04-20 ~ Sun 2026-04-26', () => {
    expect(isoWeekRange('2026-04-22')).toEqual({ start: '2026-04-20', end: '2026-04-26' });
  });

  it('Monday → 자기 자신부터 +6일', () => {
    expect(isoWeekRange('2026-04-20')).toEqual({ start: '2026-04-20', end: '2026-04-26' });
  });

  it('Sunday → 같은 주 (Mon ~ 자기 자신)', () => {
    expect(isoWeekRange('2026-04-26')).toEqual({ start: '2026-04-20', end: '2026-04-26' });
  });

  it('월 경계 — 2026-05-02(토) → 2026-04-27 ~ 2026-05-03', () => {
    expect(isoWeekRange('2026-05-02')).toEqual({ start: '2026-04-27', end: '2026-05-03' });
  });

  it('연 경계 — 2026-01-01(목) → 2025-12-29 ~ 2026-01-04', () => {
    expect(isoWeekRange('2026-01-01')).toEqual({ start: '2025-12-29', end: '2026-01-04' });
  });
});

describe('monthRange', () => {
  it('2026-04-15 → 2026-04-01 ~ 2026-04-30', () => {
    expect(monthRange('2026-04-15')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('윤년 2월 — 2024-02-15 → 2024-02-01 ~ 2024-02-29', () => {
    expect(monthRange('2024-02-15')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('평년 2월 — 2026-02-10 → 2026-02-01 ~ 2026-02-28', () => {
    expect(monthRange('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('12월 → 1~31일', () => {
    expect(monthRange('2026-12-25')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('isoWeekLabel', () => {
  it('2026-04-20 → 2026-W17', () => {
    expect(isoWeekLabel('2026-04-20')).toBe('2026-W17');
  });

  it('연도 경계 주 (Mon 2025-12-29) → 2026-W01', () => {
    expect(isoWeekLabel('2025-12-29')).toBe('2026-W01');
  });
});

describe('monthLabel', () => {
  it('2026-04-01 → 2026-04', () => {
    expect(monthLabel('2026-04-01')).toBe('2026-04');
  });
});

describe('periodRange dispatcher', () => {
  it('weekly', () => {
    expect(periodRange('weekly', '2026-04-22')).toEqual({ start: '2026-04-20', end: '2026-04-26' });
  });

  it('monthly', () => {
    expect(periodRange('monthly', '2026-04-15')).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
  });
});

describe('yearRange / yearLabel', () => {
  it('연도 경계 (1/1 ~ 12/31)', () => {
    expect(yearRange('2026-07-15')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(yearRange('2026-01-01')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('yearLabel 은 YYYY', () => {
    expect(yearLabel('2026-01-01')).toBe('2026');
  });
});
