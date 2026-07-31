'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type MobileMenuItem = { href: string; label: string };

// md 미만 전용 햄버거 메뉴 — 데스크톱 네비(Product·Worklog·Pricing·FAQ)가 숨는 폭에서
// 같은 목적지를 제공한다. 인터랙션은 product-menu 와 동일 패턴(외부클릭·ESC 닫힘)
export function MobileMenu({ label, items }: { label: string; items: readonly MobileMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2/70 hover:text-ink"
      >
        {open ? (
          <X size={16} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Menu size={16} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="menu-pop fixed inset-x-4 top-[4.25rem] z-50 origin-top rounded-xl border border-hairline bg-surface-1 p-1.5 shadow-xl shadow-black/40 sm:top-[4.5rem]"
        >
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-[14px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {it.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
