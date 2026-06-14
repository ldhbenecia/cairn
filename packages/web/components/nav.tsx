import { content, type Lang } from '../lib/content';
import { BrandMark } from './brand-mark';
import { LangSwitcher } from './lang-switcher';
import { REPO, REPO_URL } from '../lib/github';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function Nav({ stars, lang }: { stars: number; lang: Lang }) {
  const c = content[lang].nav;
  const home = lang === 'ko' ? '/ko' : '/';
  const links = [
    { href: '#how', label: c.how },
    { href: '#output', label: c.worklog },
    { href: '#setup', label: c.setup },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-hairline/60 bg-canvas/75 backdrop-blur-xl">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
        {/* brand */}
        <a
          href={home}
          className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap"
        >
          <BrandMark size={19} className="text-accent" />
          cairn
        </a>

        {/* center nav — 정중앙 고정(좌우 폭과 무관), hover pill */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-[13.5px] whitespace-nowrap text-ink-muted transition-colors hover:bg-surface-2/70 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          <LangSwitcher lang={lang} />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`GitHub — ${REPO}`}
            className="group flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface-1 py-1.5 pr-1.5 pl-2.5 text-[13px] text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="hidden font-medium sm:inline">{REPO}</span>
            <span className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-1 text-ink-subtle transition-colors group-hover:text-ink">
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
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
