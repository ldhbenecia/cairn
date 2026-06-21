'use client';

import { useEffect, useRef, useState } from 'react';

import type { Lang } from '../lib/content';

const LABELS: Record<Lang, string> = { en: 'English', ko: '한국어' };

export function LangSwitcher({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="flex items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface-1 px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M2.5 12h19M12 2.5c2.5 2.6 3.8 6 3.8 9.5s-1.3 6.9-3.8 9.5c-2.5-2.6-3.8-6-3.8-9.5S9.5 5.1 12 2.5z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        <span className="font-medium">{LABELS[lang]}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 min-w-[130px] overflow-hidden rounded-lg border border-hairline bg-surface-1 p-1 shadow-xl shadow-black/40">
          {(['en', 'ko'] as const).map((l) => (
            <a
              key={l}
              href={l === 'ko' ? '/ko' : '/'}
              className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                l === lang
                  ? 'bg-surface-2 font-medium text-ink'
                  : 'text-ink-muted hover:bg-surface-2'
              }`}
            >
              {LABELS[l]}
              {l === lang && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="var(--color-accent-hover)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
