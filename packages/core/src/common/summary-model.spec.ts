import { afterEach, describe, expect, it } from 'vitest';
import { summaryModelLabel, summaryModelOption } from './summary-model.js';

const ENV = 'CAIRN_SUMMARY_MODEL';

afterEach(() => {
  delete process.env[ENV];
});

describe('summaryModelOption', () => {
  it('passes through known aliases with an overload fallback', () => {
    const expected: Record<string, string> = { sonnet: 'opus', haiku: 'sonnet', opus: 'sonnet' };
    for (const [alias, fallback] of Object.entries(expected)) {
      process.env[ENV] = alias;
      expect(summaryModelOption()).toEqual({ model: alias, fallbackModel: fallback });
    }
  });

  it('normalizes case and whitespace', () => {
    process.env[ENV] = '  Sonnet  ';
    expect(summaryModelOption()).toEqual({ model: 'sonnet', fallbackModel: 'opus' });
  });

  it('returns no override for default / unset / unknown', () => {
    delete process.env[ENV];
    expect(summaryModelOption()).toEqual({});
    process.env[ENV] = 'default';
    expect(summaryModelOption()).toEqual({});
    process.env[ENV] = 'gpt-4';
    expect(summaryModelOption()).toEqual({});
  });
});

describe('summaryModelLabel', () => {
  it('maps actual model ids to versioned display labels', () => {
    expect(summaryModelLabel('claude-sonnet-5')).toBe('Claude Sonnet 5');
    expect(summaryModelLabel('claude-opus-4-8')).toBe('Claude Opus 4.8');
    expect(summaryModelLabel('claude-haiku-4-5-20251001')).toBe('Claude Haiku 4.5');
  });

  it('handles legacy ids with version before family', () => {
    expect(summaryModelLabel('claude-3-5-sonnet-20241022')).toBe('Claude Sonnet 3.5');
  });

  it('falls back to the configured alias without a version', () => {
    process.env[ENV] = 'sonnet';
    expect(summaryModelLabel(undefined)).toBe('Claude Sonnet');
  });

  it('returns plain Claude for default / unset / unknown', () => {
    delete process.env[ENV];
    expect(summaryModelLabel(undefined)).toBe('Claude');
    process.env[ENV] = 'default';
    expect(summaryModelLabel(undefined)).toBe('Claude');
    expect(summaryModelLabel('some-other-model')).toBe('Claude');
  });

  it('prefers the usage model over the configured alias', () => {
    process.env[ENV] = 'sonnet';
    expect(summaryModelLabel('claude-opus-4-8')).toBe('Claude Opus 4.8');
  });
});
