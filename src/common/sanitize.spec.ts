import { describe, expect, it } from 'vitest';
import { CairnError } from './error.js';
import { assertNoForbiddenPayload, sanitizeCairnError } from './sanitize.js';

describe('sanitizeCairnError', () => {
  it('strips message and keeps source / code / status', () => {
    const e = new CairnError('github', 'auth_failed', 'leaked /Users/me/.env content here', 401);
    const out = sanitizeCairnError(e);
    expect(out).toEqual({ source: 'github', code: 'auth_failed', status: 401 });
    expect(out).not.toHaveProperty('message');
  });

  it('omits status when undefined', () => {
    const e = new CairnError('local-git', 'unknown', 'oops');
    const out = sanitizeCairnError(e);
    expect(out).toEqual({ source: 'local-git', code: 'unknown' });
  });
});

describe('assertNoForbiddenPayload', () => {
  it('passes a clean payload', () => {
    const safe = {
      date: '2026-05-09',
      items: [{ repo: 'cairn', title: 'feat: 새 기능 추가' }],
    };
    expect(() => assertNoForbiddenPayload(safe, 'test')).not.toThrow();
  });

  it('passes single "diff" / "patch" word in normal prose (no false positive)', () => {
    expect(() => assertNoForbiddenPayload({ msg: 'see the diff below' }, 'test')).not.toThrow();
    expect(() => assertNoForbiddenPayload({ msg: 'apply this patch' }, 'test')).not.toThrow();
    expect(() =>
      assertNoForbiddenPayload({ msg: 'patch bump 0.5.x 운영 안정화' }, 'test'),
    ).not.toThrow();
  });

  it('throws on git diff header', () => {
    expect(() => assertNoForbiddenPayload({ snippet: 'diff --git a/foo b/foo' }, 'test')).toThrow(
      /diff-git-header/,
    );
  });

  it('throws on absolute /Users path', () => {
    expect(() => assertNoForbiddenPayload({ p: '/Users/john/secret/.env' }, 'test')).toThrow(
      /absolute-mac-path/,
    );
  });

  it('throws on Notion token prefix', () => {
    expect(() => assertNoForbiddenPayload({ token: `ntn_${'a'.repeat(40)}` }, 'test')).toThrow(
      /notion-token/,
    );
  });

  it('throws on Anthropic token prefix', () => {
    expect(() => assertNoForbiddenPayload({ token: `sk-ant-${'a'.repeat(30)}` }, 'test')).toThrow(
      /anthropic-token/,
    );
  });

  it('throws on GitHub PAT prefix', () => {
    expect(() => assertNoForbiddenPayload({ token: `ghp_${'a'.repeat(35)}` }, 'test')).toThrow(
      /github-token-classic/,
    );
  });

  it('throws on unified diff hunk @@', () => {
    expect(() => assertNoForbiddenPayload({ snippet: '@@ -1,2 +1,2 @@' }, 'test')).toThrow(
      /unified-diff-hunk/,
    );
  });

  it('accepts string payload directly', () => {
    expect(() => assertNoForbiddenPayload('safe Korean text 안전한 문자열', 'test')).not.toThrow();
    expect(() => assertNoForbiddenPayload('/Users/ldhbenecia/.env', 'test')).toThrow(
      /absolute-mac-path/,
    );
  });

  it('PR body 시뮬레이션 — 정상 markdown 통과', () => {
    const clean =
      '## 📝 요약\n\n작업 내용 요약. graceful fallback / typed error 정리.\n\n## 🛠 작업 사항\n\n- 첫 번째 변경\n- 두 번째 변경';
    expect(() => assertNoForbiddenPayload(clean, 'pr-body')).not.toThrow();
  });

  it('PR body 시뮬레이션 — unified-diff hunk 차단', () => {
    const dirty = '## 변경\n\n```\n@@ -1,2 +1,2 @@\n- old\n+ new\n```';
    expect(() => assertNoForbiddenPayload(dirty, 'pr-body')).toThrow(/unified-diff-hunk/);
  });
});
