import { afterEach, describe, expect, it } from 'vitest';
import { customPromptFor, withCustomPrompt } from './custom-prompt.js';

describe('customPromptFor', () => {
  afterEach(() => {
    delete process.env.CAIRN_PROMPT_DAILY;
    delete process.env.CAIRN_PROMPT_WEEKLY;
  });

  it('returns null when env is unset', () => {
    expect(customPromptFor('daily')).toBeNull();
  });

  it('returns null for whitespace-only value', () => {
    process.env.CAIRN_PROMPT_DAILY = '   \n  ';
    expect(customPromptFor('daily')).toBeNull();
  });

  it('reads the mode-specific env var trimmed', () => {
    process.env.CAIRN_PROMPT_WEEKLY = '  주간은 프로젝트별 진행률 위주로  ';
    expect(customPromptFor('weekly')).toBe('주간은 프로젝트별 진행률 위주로');
    expect(customPromptFor('daily')).toBeNull();
  });

  it('caps overly long input', () => {
    process.env.CAIRN_PROMPT_DAILY = 'a'.repeat(10_000);
    expect(customPromptFor('daily')?.length).toBe(4000);
  });
});

describe('withCustomPrompt', () => {
  it('returns base untouched when custom is null', () => {
    expect(withCustomPrompt('BASE', null)).toBe('BASE');
  });

  it('appends custom after the base with a guard preamble', () => {
    const out = withCustomPrompt('BASE', 'CUSTOM');
    expect(out.startsWith('BASE\n')).toBe(true);
    expect(out.endsWith('\nCUSTOM')).toBe(true);
    expect(out).toContain('non-negotiable');
  });
});
