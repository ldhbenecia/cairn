import Link from 'next/link';

import { content, type Lang } from '../lib/content';
import { getRepoStats, RELEASES_LATEST } from '../lib/github';
import { BrandMark } from './brand-mark';
import { Nav } from './nav';

const CHECKOUT_URL = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;

export async function Pricing({ lang }: { lang: Lang }) {
  const c = content[lang];
  const p = c.pricing;
  const { stars } = await getRepoStats();
  const headClass =
    lang === 'ko'
      ? 'text-[clamp(30px,4.2vw,44px)] font-semibold tracking-[-0.03em]'
      : 'font-display text-[clamp(38px,5vw,56px)] leading-[1.06]';

  return (
    <div className="pt-16">
      <Nav stars={stars} lang={lang} />

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24 sm:pt-24">
        <p className="mb-4 inline-flex items-center gap-2 font-mono text-[12px] tracking-wider text-ink-tertiary uppercase">
          <span className="size-1.5 rounded-full bg-accent" />
          {p.eyebrow}
        </p>
        <h1 className={`${headClass} text-balance`}>{p.title}</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-subtle">{p.lead}</p>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-3">
          <Tier
            name={p.free.name}
            price={p.free.price}
            note={p.free.note}
            features={p.free.features}
            action={
              <a
                href={RELEASES_LATEST}
                className="inline-block rounded-full border border-hairline-strong px-5 py-2 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
              >
                {p.free.cta}
              </a>
            }
          />
          <Tier
            name={p.pro.name}
            price={p.pro.price}
            note={p.pro.note}
            features={p.pro.features}
            highlight
            action={
              CHECKOUT_URL ? (
                <a
                  href={CHECKOUT_URL}
                  className="inline-block rounded-full bg-accent px-5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  {p.pro.cta}
                </a>
              ) : (
                <span className="inline-block rounded-full border border-hairline-strong px-5 py-2 text-[13.5px] font-medium text-ink-tertiary">
                  {p.pro.ctaSoon}
                </span>
              )
            }
          />
          <Tier
            name={p.cloud.name}
            price={p.cloud.price}
            note={p.cloud.note}
            features={p.cloud.features}
            dim
            action={
              <span className="inline-block rounded-full border border-hairline px-5 py-2 text-[13.5px] font-medium text-ink-tertiary">
                {p.cloud.cta}
              </span>
            }
          />
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-ink-tertiary">{p.footnote}</p>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8 text-[13px] text-ink-tertiary">
          <span className="flex items-center gap-2">
            <BrandMark size={15} className="text-accent" />
            cairn
          </span>
          <Link href={lang === 'ko' ? '/ko' : '/'} className="hover:text-ink">
            {p.back}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Tier({
  name,
  price,
  note,
  features,
  action,
  highlight = false,
  dim = false,
}: {
  name: string;
  price: string;
  note: string;
  features: readonly string[];
  action: React.ReactNode;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={[
        'relative flex flex-col bg-canvas p-7',
        highlight ? 'bg-surface-1' : '',
        dim ? 'select-none opacity-60' : '',
      ].join(' ')}
    >
      {highlight && <span className="absolute inset-x-0 top-0 h-px bg-accent/70" />}
      <h2 className="text-[14px] font-semibold text-ink">{name}</h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-[32px] leading-none font-semibold tracking-[-0.5px] text-ink tabular-nums">
          {price}
        </span>
        <span className="text-[12.5px] text-ink-tertiary">{note}</span>
      </p>
      <ul className="mt-6 mb-8 flex flex-col gap-2.5 text-[13px] leading-snug text-ink-muted">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              className="mt-1 shrink-0"
            >
              <path
                d="M2.5 6.5L5 9l4.5-5.5"
                stroke="var(--color-accent-hover)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto">{action}</div>
    </div>
  );
}
