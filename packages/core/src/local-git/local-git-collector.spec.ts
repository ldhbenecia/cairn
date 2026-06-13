import { describe, expect, it } from 'vitest';
import { isForbiddenSubject } from './local-git-collector.service.js';

describe('isForbiddenSubject', () => {
  it('allows normal commit subjects', () => {
    expect(isForbiddenSubject('feat(summarizer): tools')).toBe(false);
    expect(isForbiddenSubject('fix: password reset flow')).toBe(false);
    expect(isForbiddenSubject('chore: bump token rotation interval')).toBe(false);
  });

  it('flags subjects leaking an absolute path', () => {
    expect(isForbiddenSubject('move config from /Users/me/.env')).toBe(true);
  });

  it('flags subjects containing a pasted secret token', () => {
    expect(isForbiddenSubject(`oops committed sk-ant-${'a'.repeat(30)}`)).toBe(true);
    expect(isForbiddenSubject(`leak ghp_${'a'.repeat(35)}`)).toBe(true);
  });

  it('flags subjects containing diff markers', () => {
    expect(isForbiddenSubject('paste: @@ -1,2 +1,2 @@ hunk')).toBe(true);
  });
});
