import { describe, expect, it } from 'vitest';
import { localDateToUtcWindow, searchRangeFragment, todayLocalIsoDate } from './date-window.js';

describe('localDateToUtcWindow', () => {
  it('spans the local calendar day (00:00:00 ~ 23:59:59 local)', () => {
    const w = localDateToUtcWindow('2026-06-03');
    const start = new Date(w.startIso);
    const end = new Date(w.endIso);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 5, 3]);
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 5, 3]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59]);
  });

  it('emits UTC ISO without milliseconds', () => {
    const w = localDateToUtcWindow('2026-01-15');
    expect(w.startIso).toMatch(/Z$/);
    expect(w.startIso).not.toMatch(/\.\d{3}Z$/);
    expect(w.endIso).toMatch(/Z$/);
  });

  it('throws on malformed date', () => {
    expect(() => localDateToUtcWindow('2026-06')).toThrow();
  });
});

describe('todayLocalIsoDate', () => {
  it('returns today in the machine local calendar date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayLocalIsoDate()).toBe(expected);
  });
});

describe('searchRangeFragment', () => {
  it('joins start and end with ..', () => {
    expect(searchRangeFragment({ startIso: 'A', endIso: 'B' })).toBe('A..B');
  });
});
