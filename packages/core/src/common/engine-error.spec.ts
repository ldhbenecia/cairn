import { describe, expect, it } from 'vitest';
import { engineError } from './engine-error.js';
import { CairnError } from './error.js';

describe('engineError', () => {
  it.each([
    [
      'Claude Code returned an error result: Failed to authenticate: OAuth session expired and could not be refreshed',
      'auth_failed',
    ],
    ['Please run /login', 'auth_failed'],
    ['codex: You are not logged in. Run codex login', 'auth_failed'],
    [
      'codex: unexpected status 401 Unauthorized: Missing bearer or basic authentication in header',
      'auth_failed',
    ],
    ['Claude AI usage limit reached|1793880000', 'rate_limited'],
    ['codex: You have hit your usage limit. Try again later', 'rate_limited'],
    [
      "codex: The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.",
      'unknown',
    ],
    ['codex: timed out', 'unknown'],
  ])('%s → %s', (message, code) => {
    const e = engineError(new Error(message));
    expect(e).toBeInstanceOf(CairnError);
    expect(e.source).toBe('summarizer');
    expect(e.code).toBe(code);
  });

  it('keeps a code that was already classified', () => {
    const forbidden = new CairnError('summarizer', 'forbidden', 'codex used a tool (401)');
    expect(engineError(forbidden).code).toBe('forbidden');
  });
});
