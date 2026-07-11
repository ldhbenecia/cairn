import { describe, expect, it } from 'vitest';
import {
  localDateStartIsoBefore,
  localDateToUtcWindow,
  searchRangeFragment,
  todayLocalIsoDate,
} from './date-window.js';

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

  it('연속된 날의 윈도우가 인접 — 사이에 dead zone 없음 (DST 폴백 대비)', () => {
    // end 를 다음날 자정 −1ms 에서 유도하므로 D 의 end 와 D+1 의 start 사이 간극은 최대 1초.
    // 고정 23:59:59 였다면 자정 DST 폴백 TZ 에서 1시간 갭이 났다
    const endD = new Date(localDateToUtcWindow('2026-06-03').endIso).getTime();
    const startNext = new Date(localDateToUtcWindow('2026-06-04').startIso).getTime();
    expect(startNext - endD).toBeLessThanOrEqual(1000);
    expect(startNext - endD).toBeGreaterThan(0);
  });

  it('월말 경계도 다음달 1일과 인접', () => {
    const endD = new Date(localDateToUtcWindow('2026-01-31').endIso).getTime();
    const startNext = new Date(localDateToUtcWindow('2026-02-01').startIso).getTime();
    expect(startNext - endD).toBeLessThanOrEqual(1000);
  });
});

describe('todayLocalIsoDate', () => {
  it('returns today in the machine local calendar date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayLocalIsoDate()).toBe(expected);
  });
});

describe('localDateStartIsoBefore', () => {
  it('matches the local midnight of (date - days)', () => {
    const iso = localDateStartIsoBefore('2026-06-13', 14);
    expect(iso).toBe(localDateToUtcWindow('2026-05-30').startIso);
  });

  it('days=0 equals the local midnight of the date itself', () => {
    const iso = localDateStartIsoBefore('2026-06-13', 0);
    expect(iso).toBe(localDateToUtcWindow('2026-06-13').startIso);
  });

  it('rolls over month/year boundaries in local time', () => {
    const iso = localDateStartIsoBefore('2026-01-05', 10);
    expect(iso).toBe(localDateToUtcWindow('2025-12-26').startIso);
  });

  it('throws on malformed date', () => {
    expect(() => localDateStartIsoBefore('2026-06', 7)).toThrow();
  });
});

describe('searchRangeFragment', () => {
  it('joins start and end with ..', () => {
    expect(searchRangeFragment({ startIso: 'A', endIso: 'B' })).toBe('A..B');
  });
});
