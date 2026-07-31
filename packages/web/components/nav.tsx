import Link from 'next/link';

import { content, type Lang } from '../lib/content';
import { RELEASES_LATEST, REPO, REPO_URL } from '../lib/github';
import { BrandMark } from './brand-mark';
import { LangSwitcher } from './lang-switcher';
import { MobileMenu } from './mobile-menu';
import { ProductMenu } from './product-menu';

const NAV_LINK =
  'rounded-lg px-3 py-1.5 text-[13.5px] whitespace-nowrap text-ink-muted transition-colors hover:bg-surface-2/70 hover:text-ink';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function Nav({ stars, lang }: { stars: number; lang: Lang }) {
  const c = content[lang].nav;
  const home = lang === 'ko' ? '/ko' : '/';
  // 해시 앵커는 홈 절대경로로 — /pricing·/setup 등 다른 페이지에서도 홈 섹션으로 이동
  const productItems = c.productItems.map((it) => ({
    ...it,
    href: it.href.startsWith('#') ? `${home}${it.href}` : it.href,
  }));
  const pricingHref = lang === 'ko' ? '/ko/pricing' : '/pricing';
  // md 미만에서 데스크톱 네비가 숨을 때 같은 목적지를 제공하는 햄버거 항목
  const mobileItems = [
    ...productItems.map(({ href, label }) => ({ href, label })),
    { href: `${home}#output`, label: c.worklog },
    { href: pricingHref, label: c.pricing },
    { href: `${home}#faq`, label: c.faq },
  ];

  // fixed (sticky X) — body { overflow-x: hidden } 이 sticky 의 스크롤 컨테이너를 body 로 만들어 고정이 풀림
  return (
    <header className="fixed inset-x-0 top-0 z-50 md:px-4 md:pt-4">
      {/* 모바일: 플랫 풀폭 바(로고+햄버거) — 앱 설치 불가 폭이라 CTA 없이 탐색만. md+: 기존 필 */}
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between border-b border-hairline bg-canvas/75 px-4 backdrop-blur-xl md:rounded-full md:border md:pr-1.5 md:pl-4 md:shadow-[0_8px_32px_-16px_rgba(0,0,0,0.7)]">
        <a
          href={home}
          className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap"
        >
          <BrandMark size={19} className="text-accent" />
          cairn
        </a>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <nav className="hidden items-center gap-0.5 md:flex">
            <ProductMenu label={c.product} items={productItems} />
            <a href={`${home}#output`} className={NAV_LINK}>
              {c.worklog}
            </a>
            <Link href={pricingHref} className={NAV_LINK}>
              {c.pricing}
            </Link>
            <a href={`${home}#faq`} className={NAV_LINK}>
              {c.faq}
            </a>
          </nav>
          <MobileMenu label={c.menu} items={mobileItems} lang={lang} />
          <span className="mx-0.5 hidden h-4 w-px bg-hairline-strong md:block" />
          <span className="hidden md:block">
            <LangSwitcher lang={lang} />
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`GitHub — ${REPO}`}
            className="group hidden items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-1 px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink md:flex"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              className="text-ink-tertiary transition-colors group-hover:text-yellow-400"
            >
              <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
            </svg>
            <span className="font-mono text-[12px] leading-none">{formatStars(stars)}</span>
          </a>
          <a
            href={RELEASES_LATEST}
            className="hidden rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-white transition-[background-color,scale] hover:bg-accent-hover active:scale-[0.96] md:inline-flex"
          >
            {c.getStarted}
          </a>
        </div>
      </div>
    </header>
  );
}
