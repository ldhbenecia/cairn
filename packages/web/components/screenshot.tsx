'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// 제품 스크린샷 — 프레임에 담고, 클릭하면 라이트박스로 크게 본다.
export function Screenshot({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge — ${alt}`}
        className="screenshot-frame group block w-full cursor-zoom-in p-0 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block w-full transition-transform duration-500 group-hover:scale-[1.015]"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
        <span className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 rounded-md border border-hairline-strong bg-canvas/80 px-2 py-1 text-[11px] font-medium text-ink-muted opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Expand
        </span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={() => setOpen(false)}
            className="lightbox-fade fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[92vh] max-w-[94vw] rounded-xl border border-hairline-strong shadow-2xl shadow-black/60"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
