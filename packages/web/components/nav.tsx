import { content, type Lang } from '../lib/content';
import { BrandMark } from './brand-mark';
import { REPO, REPO_URL } from '../lib/github';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function Nav({ stars, lang }: { stars: number; lang: Lang }) {
  const c = content[lang].nav;
  return (
    <header className="sticky top-0 z-50 border-b border-hairline/70 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <a href={lang === 'ko' ? '/ko' : '/'} className="flex items-center gap-2 text-[15px] font-semibold">
          <BrandMark size={18} className="text-accent" />
          cairn
        </a>
        <nav className="hidden items-center gap-7 text-[14px] text-ink-subtle sm:flex">
          <a href="#how" className="transition-colors hover:text-ink">
            {c.how}
          </a>
          <a href="#output" className="transition-colors hover:text-ink">
            {c.worklog}
          </a>
          <a href="#setup" className="transition-colors hover:text-ink">
            {c.setup}
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-0.5 rounded-lg border border-hairline-strong bg-surface-1 p-0.5 text-[12px]">
          <a
            href="/"
            className={`rounded-md px-2 py-1 transition-colors ${lang === 'en' ? 'bg-surface-3 font-medium text-ink' : 'text-ink-subtle hover:text-ink'}`}
          >
            EN
          </a>
          <a
            href="/ko"
            className={`rounded-md px-2 py-1 transition-colors ${lang === 'ko' ? 'bg-surface-3 font-medium text-ink' : 'text-ink-subtle hover:text-ink'}`}
          >
            한국어
          </a>
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface-1 py-1.5 pr-2.5 pl-2.5 text-[13px] text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="font-medium">{REPO}</span>
          <span className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-subtle transition-colors group-hover:text-ink">
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
            <span className="font-mono">{formatStars(stars)}</span>
          </span>
        </a>
        </div>
      </div>
    </header>
  );
}
