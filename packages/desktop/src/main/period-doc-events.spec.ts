import { describe, expect, it } from 'vitest';
import { isValidRange, parsePeriodDocEvent, periodDocFileName } from './period-doc-events';

describe('isValidRange', () => {
  it('accepts a single day and up to 366 days', () => {
    expect(isValidRange({ since: '2026-07-01', until: '2026-07-01' })).toBe(true);
    expect(isValidRange({ since: '2028-01-01', until: '2028-12-31' })).toBe(true);
  });

  it('rejects reversed, over-long, malformed and path-like input', () => {
    expect(isValidRange({ since: '2026-07-02', until: '2026-07-01' })).toBe(false);
    expect(isValidRange({ since: '2026-01-01', until: '2027-01-02' })).toBe(false);
    expect(isValidRange({ since: '../../etc', until: '2026-07-01' })).toBe(false);
    expect(isValidRange({ since: '2026-7-1', until: '2026-07-01' })).toBe(false);
    expect(isValidRange(null)).toBe(false);
  });
});

describe('parsePeriodDocEvent', () => {
  it('parses written/empty events', () => {
    expect(
      parsePeriodDocEvent({
        cairn: 1,
        type: 'period-doc-written',
        fileName: '2026-07-01_2026-09-30.md',
      }),
    ).toEqual({ type: 'written', fileName: '2026-07-01_2026-09-30.md' });
    expect(parsePeriodDocEvent({ cairn: 1, type: 'period-doc-empty' })).toEqual({ type: 'empty' });
  });

  it('ignores unrelated events and unsafe file names', () => {
    expect(parsePeriodDocEvent({ cairn: 1, type: 'day-done' })).toBeNull();
    expect(
      parsePeriodDocEvent({ cairn: 1, type: 'period-doc-written', fileName: '../x.md' }),
    ).toBeNull();
    expect(parsePeriodDocEvent({ type: 'period-doc-empty' })).toBeNull();
  });
});

describe('periodDocFileName', () => {
  it('matches the core naming', () => {
    expect(periodDocFileName({ since: '2026-07-01', until: '2026-09-30' })).toBe(
      '2026-07-01_2026-09-30.md',
    );
  });
});
