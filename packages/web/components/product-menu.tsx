'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type ProductMenuItem = { href: string; label: string; desc: string };

export function ProductMenu({
  label,
  items,
}: {
  label: string;
  items: readonly ProductMenuItem[];
}) {
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
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13.5px] whitespace-nowrap transition-colors hover:bg-surface-2/70 hover:text-ink ${
          open ? 'bg-surface-2/70 text-ink' : 'text-ink-muted'
        }`}
      >
        {label}
        <ChevronDown
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className={`text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="menu-pop absolute left-0 z-50 mt-2 w-[290px] rounded-xl border border-hairline bg-surface-1 p-1.5 shadow-xl shadow-black/40"
        >
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2"
            >
              <span className="block text-[13.5px] font-medium text-ink-muted">{it.label}</span>
              <span className="mt-0.5 block text-[12px] text-ink-tertiary">{it.desc}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
