import type { CairnError } from './error.js';

export interface CairnErrorExternal {
  source: string;
  code: string;
  status?: number;
}

export function sanitizeCairnError(e: CairnError): CairnErrorExternal {
  return {
    source: e.source,
    code: e.code,
    ...(typeof e.status === 'number' ? { status: e.status } : {}),
  };
}

const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'unified-diff-hunk', pattern: /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/ },
  { name: 'unified-diff-old', pattern: /^---\s/m },
  { name: 'unified-diff-new', pattern: /^\+\+\+\s/m },
  { name: 'diff-git-header', pattern: /\bdiff --git\b/ },
  { name: 'absolute-mac-path', pattern: /\/Users\/[A-Za-z0-9._-]+/ },
  { name: 'absolute-posix-home', pattern: /\/home\/[A-Za-z0-9._-]+/ },
  { name: 'absolute-windows-path', pattern: /\b[A-Za-z]:[\\/]{1,2}[A-Za-z0-9._-]/ },
  { name: 'notion-token', pattern: /\bntn_[A-Za-z0-9]{32,}/ },
  { name: 'anthropic-token', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'openai-token', pattern: /\bsk-(?!ant-)[A-Za-z0-9_-]{20,}/ },
  { name: 'github-token-classic', pattern: /\bghp_[A-Za-z0-9]{30,}/ },
  { name: 'github-token-fine', pattern: /\bgithub_pat_[A-Za-z0-9_]{30,}/ },
  { name: 'generic-secret-prefix', pattern: /\bsecret_[A-Za-z0-9_-]{16,}/ },
  { name: 'fenced-code-block', pattern: /```/ },
  { name: 'email-address', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];

export function assertNoForbiddenPayload(payload: unknown, label: string): void {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(json)) {
      throw new Error(`sanitize.${label}: forbidden pattern '${name}' matched`);
    }
  }
}
