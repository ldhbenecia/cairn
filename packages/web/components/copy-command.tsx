'use client';

import { useState } from 'react';

export function CopyCommand({ command, copyLabel }: { command: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);

  // 상태 전환 아이콘은 교체 대신 크로스페이드 — 둘 다 DOM 에 두고 opacity·scale·blur 로 전환
  const iconBase =
    'absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]';

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
      className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-left transition-[border-color,scale] hover:border-ink-subtle active:scale-[0.96]"
    >
      <code className="min-w-0 truncate font-mono text-[12px] text-ink-muted">{command}</code>
      <span className="relative size-3.5 shrink-0 text-ink-tertiary transition-colors group-hover:text-ink-muted">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`${iconBase} ${copied ? 'scale-25 opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0'}`}
        >
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 15V5a2 2 0 0 1 2-2h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`${iconBase} ${copied ? 'scale-100 opacity-100 blur-0' : 'scale-25 opacity-0 blur-[4px]'}`}
        >
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--color-accent-hover)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
