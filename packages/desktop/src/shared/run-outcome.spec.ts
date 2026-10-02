import { describe, expect, it } from 'vitest';
import { classifyRunOutcome } from './run-outcome';

const base = {
  ok: true,
  summaryFailed: false,
  noActivity: false,
  publishKind: 'created' as const,
  journalFile: '2026-10-02.md',
  failureHint: null,
};

describe('classifyRunOutcome', () => {
  it('prefers a specific failure cause over the generic summary failure', () => {
    expect(
      classifyRunOutcome({ ...base, ok: false, summaryFailed: true, failureHint: 'claude-auth' }),
    ).toBe('fail');
    expect(classifyRunOutcome({ ...base, ok: false, summaryFailed: true })).toBe('summaryFailed');
    expect(classifyRunOutcome({ ...base, ok: false })).toBe('fail');
  });

  it('treats a local-only run with a written journal as done', () => {
    expect(classifyRunOutcome({ ...base, publishKind: 'no-target' })).toBe('localDone');
    expect(classifyRunOutcome({ ...base, publishKind: 'no-target', journalFile: null })).toBe(
      'noTarget',
    );
  });

  it('never reports no-activity or skipped runs as done', () => {
    expect(classifyRunOutcome({ ...base, publishKind: null, noActivity: true })).toBe('noActivity');
    expect(classifyRunOutcome({ ...base, publishKind: 'skipped' })).toBe('skipped');
    expect(classifyRunOutcome(base)).toBe('done');
  });
});
