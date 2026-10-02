import { describe, expect, it } from 'vitest';
import { parsePeriodDocArgs } from './cli-args.js';

describe('parsePeriodDocArgs', () => {
  it('parses a valid range', () => {
    expect(
      parsePeriodDocArgs(['--period-doc', '--since=2026-07-01', '--until=2026-09-30', '--lang=en']),
    ).toEqual({ since: '2026-07-01', until: '2026-09-30', lang: 'en' });
  });

  it('allows a single day and a full leap year (366 days)', () => {
    expect(parsePeriodDocArgs(['--since=2026-07-01', '--until=2026-07-01']).since).toBe(
      '2026-07-01',
    );
    expect(parsePeriodDocArgs(['--since=2028-01-01', '--until=2028-12-31']).until).toBe(
      '2028-12-31',
    );
  });

  it('rejects reversed, over-long and malformed ranges', () => {
    expect(() => parsePeriodDocArgs(['--since=2026-07-02', '--until=2026-07-01'])).toThrow(
      /on or before/,
    );
    expect(() => parsePeriodDocArgs(['--since=2026-01-01', '--until=2027-01-02'])).toThrow(
      /too long/,
    );
    expect(() => parsePeriodDocArgs(['--since=2026-02-30', '--until=2026-03-01'])).toThrow();
    expect(() => parsePeriodDocArgs(['--until=2026-03-01'])).toThrow();
  });
});
