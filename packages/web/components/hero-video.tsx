'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function HeroVideo({
  src,
  poster,
  alt,
  expandLabel,
}: {
  src: string;
  poster: string;
  alt: string;
  expandLabel: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);

  // prefers-reduced-motion 존중: 모션 최소화 설정이면 인라인 재생을 멈추고 poster 만 보여준다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => {
      if (mq.matches) video.pause();
      else void video.play().catch(() => {});
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

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
        aria-label={expandLabel}
        className="screenshot-frame group block w-full cursor-zoom-in p-0 text-left"
      >
        <video
          ref={videoRef}
          className="block w-full transition-transform duration-500 group-hover:scale-[1.015]"
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
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
          {expandLabel}
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
            <video
              className="max-h-[92vh] max-w-[94vw] rounded-xl border border-hairline-strong shadow-2xl shadow-black/60"
              src={src}
              poster={poster}
              autoPlay
              muted
              loop
              playsInline
            />
          </div>,
          document.body,
        )}
    </>
  );
}
