'use client';

import { useState } from 'react';

export function CopyCommand({ command, copyLabel }: { command: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (!navigator.clipboard) return;
        void navigator.clipboard
          .writeText(command)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch((err) => console.error('clipboard write failed', err));
      }}
      aria-label={copyLabel}
      className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-left transition-colors hover:border-ink-subtle"
    >
      <code className="truncate font-mono text-[12px] text-ink-muted">{command}</code>
      <span className="shrink-0 text-ink-tertiary transition-colors group-hover:text-ink-muted">
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="var(--color-accent-hover)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M5 15V5a2 2 0 0 1 2-2h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
