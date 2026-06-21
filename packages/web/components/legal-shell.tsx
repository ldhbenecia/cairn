import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandMark } from './brand-mark';

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-accent text-white">
              <BrandMark size={15} />
            </span>
            cairn
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em]">{title}</h1>
        <p className="mt-2 text-[13px] text-ink-tertiary">Last updated: {updated}</p>
        <div className="mt-8 space-y-7 text-[14.5px] leading-relaxed text-ink-subtle">
          {children}
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-3xl px-6 py-6 text-[13px] text-ink-tertiary">
          © {new Date().getFullYear()} Cairn ·{' '}
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[16px] font-semibold text-ink">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
