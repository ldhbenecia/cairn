'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Lang } from '../lib/content';
import { REPO_URL } from '../lib/github';
import { LangSwitcher } from './lang-switcher';

export type MobileMenuItem = { href: string; label: string };

// md 미만 전용 — 우측 슬라이드 드로어. 모바일은 앱 설치가 불가해 CTA 없이 탐색만 제공한다.
// 헤더의 backdrop-blur 가 fixed 자손의 containing block 이 되므로 드로어는 body 로 portal.
// 열릴 때만 마운트(SSR 무해)하고, 닫힘은 drawer-out 애니메이션 후 언마운트(라이트박스 패턴)
export function MobileMenu({
  label,
  items,
  lang,
}: {
  label: string;
  items: readonly MobileMenuItem[];
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const close = (): void => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 260);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2/70 hover:text-ink"
      >
        <Menu size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              onClick={close}
              className={`${closing ? 'lightbox-fade-out' : 'lightbox-fade'} fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]`}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className={`${closing ? 'drawer-out' : 'drawer-in'} fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l border-hairline bg-canvas`}
            >
              <div className="flex h-12 items-center justify-end px-3">
                <button
                  type="button"
                  aria-label={label}
                  onClick={close}
                  className="flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2/70 hover:text-ink"
                >
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3">
                {items.map((it) => (
                  <a
                    key={it.href}
                    href={it.href}
                    onClick={close}
                    className="block rounded-lg px-3 py-3 text-[15px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    {it.label}
                  </a>
                ))}
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                  className="block rounded-lg px-3 py-3 text-[15px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  GitHub
                </a>
              </nav>
              <div className="border-t border-hairline p-4">
                <LangSwitcher lang={lang} />
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
