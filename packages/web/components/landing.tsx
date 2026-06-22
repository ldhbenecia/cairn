import { CalendarDays, GitPullRequest, LayoutDashboard, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { content, type Lang } from '../lib/content';
import { getRepoStats, RELEASES_LATEST, REPO_URL } from '../lib/github';
import { BrandMark } from './brand-mark';
import { CopyCommand } from './copy-command';
import { HeroVideo } from './hero-video';
import { LangSwitcher } from './lang-switcher';
import { Nav } from './nav';
import { Reveal } from './reveal';
import { Screenshot } from './screenshot';
import { BentoGrid, type BentoItem } from './ui/bento-grid';

const HL_ICONS = [GitPullRequest, Sparkles, CalendarDays, LayoutDashboard, ShieldCheck];
const HL_COLORS = [
  'text-blue-400',
  'text-emerald-400',
  'text-violet-400',
  'text-amber-400',
  'text-sky-400',
];
const HL_SPAN = [2, 1, 2, 1, 2];
const HL_PERSIST = [true, false, false, false, false];

export async function Landing({ lang }: { lang: Lang }) {
  const c = content[lang];
  const { stars, latestTag } = await getRepoStats();
  const download = RELEASES_LATEST;
  const unblockCmd = 'xattr -d com.apple.quarantine /Applications/Cairn.app';
  const highlightItems: BentoItem[] = c.highlights.items.map((it, i) => {
    const Icon = HL_ICONS[i] ?? Sparkles;
    return {
      ...it,
      icon: <Icon className={`h-4 w-4 ${HL_COLORS[i] ?? 'text-ink-subtle'}`} />,
      colSpan: HL_SPAN[i] ?? 1,
      hasPersistentHover: HL_PERSIST[i] ?? false,
    };
  });

  return (
    <div id="top">
      <Nav stars={stars} lang={lang} />

      <section className="relative px-6 pt-16 pb-20 sm:pt-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
          <div className="reveal">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-hairline-strong bg-surface-1 py-1.5 pr-3.5 pl-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {c.hero.badge}
            </a>
            <h1 className="text-[clamp(38px,5vw,60px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              {c.hero.h1a}
              <br />
              <span className="text-ink-subtle">{c.hero.h1b}</span>
            </h1>
            <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-ink-subtle">
              {c.hero.lead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <a
                href={download}
                className="rounded-lg bg-accent px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                {c.hero.download}
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-hairline-strong bg-surface-1 px-5 py-2.5 text-[14.5px] font-semibold text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
              >
                {c.hero.source}
              </a>
            </div>
            <p className="mt-5 font-mono text-[12.5px] text-ink-tertiary">
              {latestTag ? `${latestTag} · ` : ''}
              {c.hero.sub}
            </p>
            <div className="mt-5 max-w-md">
              <p className="mb-2 text-[12.5px] leading-relaxed text-ink-tertiary">
                {c.hero.unsigned}
              </p>
              <CopyCommand command={unblockCmd} copyLabel={c.hero.copyCmd} />
            </div>
          </div>

          <div className="reveal relative" style={{ animationDelay: '0.1s' }}>
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] opacity-70"
              style={{
                background:
                  'radial-gradient(60% 60% at 70% 30%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%)',
                filter: 'blur(36px)',
              }}
            />
            <HeroVideo
              src="/intro.mp4"
              poster={`/statistic_${lang === 'ko' ? 'ko' : 'us'}.png`}
              alt={lang === 'ko' ? 'cairn 데모 영상' : 'cairn demo'}
              expandLabel={c.hero.expand}
            />
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead eyebrow={c.how.eyebrow} title={c.how.title} lead={c.how.lead} />
        <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-4 md:grid-rows-2">
          <Reveal className="md:col-span-2 md:row-span-2">
            <div className="card-hover group/c relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-8">
              <span className="font-mono text-[13px] font-medium text-accent-hover">01</span>
              <CollectVisual />
              <div>
                <h3 className="text-[22px] font-semibold tracking-[-0.02em]">
                  {c.how.steps[0]!.t}
                </h3>
                <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-subtle">
                  {c.how.steps[0]!.d}
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal className="md:col-span-2" delay={0.06}>
            <BentoTile
              n="02"
              title={c.how.steps[1]!.t}
              desc={c.how.steps[1]!.d}
              className="h-full"
            />
          </Reveal>
          <Reveal className="md:col-span-2" delay={0.12}>
            <BentoTile
              n="03"
              title={c.how.steps[2]!.t}
              desc={c.how.steps[2]!.d}
              className="h-full"
            />
          </Reveal>
        </div>

        <Reveal delay={0.1} className="relative mx-auto mt-10 max-w-4xl">
          <div
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] opacity-50"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 30%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <Screenshot
            src={`/summarizing_${lang === 'ko' ? 'ko' : 'us'}.png`}
            alt="cairn publishing a worklog"
          />
        </Reveal>
      </section>

      <section id="highlights" className="mx-auto max-w-6xl px-6 pb-24">
        <SectionHead
          eyebrow={c.highlights.eyebrow}
          title={c.highlights.title}
          lead={c.highlights.lead}
        />
        <Reveal className="mt-10">
          <BentoGrid items={highlightItems} />
        </Reveal>
      </section>

      <section id="output" className="border-y border-hairline bg-surface-1/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead eyebrow={c.output.eyebrow} title={c.output.title} lead={c.output.lead} />
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {c.output.ticks.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2 rounded-full border border-hairline bg-surface-1 px-3.5 py-1.5 text-[13px] text-ink-muted"
              >
                <Check />
                {t}
              </li>
            ))}
          </ul>
          <Reveal delay={0.08} className="relative mt-14">
            <div
              className="pointer-events-none absolute -inset-x-4 -top-10 bottom-0 -z-10 opacity-60 sm:-inset-x-10"
              style={{
                background:
                  'radial-gradient(50% 50% at 50% 25%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 70%)',
                filter: 'blur(44px)',
              }}
            />
            <Screenshot
              src={`/worklog_${lang === 'ko' ? 'ko' : 'us'}.png`}
              alt="a published cairn worklog in Notion"
            />
          </Reveal>
        </div>
      </section>

      <section id="setup" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead eyebrow={c.setup.eyebrow} title={c.setup.title} lead={c.setup.lead} />
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
          <SetupCard tag="Notion" title={c.setup.notion.title}>
            <li>
              {c.setup.notion.s1pre}
              <SetupLink href="https://www.notion.so/my-integrations">
                {c.setup.notion.s1link}
              </SetupLink>
              {c.setup.notion.s1post}
              <code className="text-ink-muted">ntn_…</code>).
            </li>
            <li>{c.setup.notion.s2}</li>
            <li>{c.setup.notion.s3}</li>
          </SetupCard>
          <SetupCard tag="GitHub" title={c.setup.github.title}>
            <li className="marker:text-accent-hover">
              <span className="text-ink-muted">{c.setup.github.ghAuto}</span>
            </li>
            <li>
              {c.setup.github.s1pre}
              <SetupLink href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=cairn%20worklog">
                {c.setup.github.s1link}
              </SetupLink>
              {c.setup.github.s1post}
            </li>
            <li>
              {c.setup.github.s2pre}
              <em>{c.setup.github.s2em}</em>
            </li>
            <li>{c.setup.github.s3}</li>
          </SetupCard>
          <SetupCard tag="Claude" title={c.setup.claude.title}>
            <li>
              {c.setup.claude.s1pre}
              <SetupLink href="https://docs.claude.com/en/docs/claude-code/setup">
                {c.setup.claude.s1link}
              </SetupLink>
              {c.setup.claude.s1post}
            </li>
            <li>{c.setup.claude.s2}</li>
          </SetupCard>
        </div>
        <Reveal delay={0.08} className="relative mx-auto mt-10 max-w-3xl">
          <p className="mb-3 text-center text-[13px] text-ink-tertiary">{c.setup.notionVideo}</p>
          <div className="screenshot-frame overflow-hidden">
            <video
              className="block w-full"
              src="/notion-integration.mp4"
              poster="/notion-integration-poster.png"
              controls
              muted
              playsInline
              preload="metadata"
              aria-label={c.setup.notionVideo}
            />
          </div>
        </Reveal>
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4 text-[13.5px] leading-relaxed text-ink-subtle">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d4a574]" />
          <p className="min-w-0">
            <strong className="font-medium text-ink-muted">{c.setup.gatekeeperPre}</strong>
            {c.setup.gatekeeper}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink-muted">
              xattr -d com.apple.quarantine /Applications/Cairn.app
            </code>
            {c.setup.gatekeeperPost}
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-hairline bg-surface-1 px-8 py-16 text-center sm:py-20">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, color-mix(in srgb, var(--color-accent) 60%, transparent), transparent)',
            }}
          />
          <h2 className="text-[clamp(28px,4vw,42px)] font-semibold tracking-[-0.03em] text-balance">
            {c.cta.title}
          </h2>
          <a
            href={download}
            className="mt-8 inline-block rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {c.cta.button}
          </a>
          <p className="mt-4 font-mono text-[12.5px] text-ink-tertiary">
            {latestTag ? `${latestTag} · ` : ''}
            {c.hero.sub}
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-[12.5px] text-ink-tertiary">{c.hero.unsigned}</p>
            <CopyCommand command={unblockCmd} copyLabel={c.hero.copyCmd} />
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-[14px]">
            <BrandMark size={16} className="text-accent" />
            <span className="font-semibold">cairn</span>
            <span className="text-ink-tertiary">© {new Date().getFullYear()} Cairn</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13.5px] text-ink-subtle">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
            <a
              href={`${REPO_URL}/blob/main/docs/SETUP.md`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              {c.footer.docs}
            </a>
            <Link href="/privacy" className="hover:text-ink">
              {c.footer.privacy}
            </Link>
            <Link href="/terms" className="hover:text-ink">
              {c.footer.terms}
            </Link>
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              AGPL-3.0
            </a>
            <LangSwitcher lang={lang} />
          </div>
        </div>
      </footer>
    </div>
  );
}

const COLLECT_ROWS = [
  { kind: 'PR', text: 'feat(api): chunk oversized queries', meta: '#142' },
  { kind: 'commit', text: 'fix: race in publish queue', meta: 'a8bf3c' },
  { kind: 'PR', text: 'refactor: collector dedup + cache', meta: '#138' },
];

function CollectVisual() {
  return (
    <div className="my-6 flex flex-col gap-2">
      {COLLECT_ROWS.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-2/70 px-3 py-2.5"
          style={{ marginLeft: `${i * 16}px`, opacity: 1 - i * 0.16 }}
        >
          <span
            className={`flex h-[18px] shrink-0 items-center rounded px-1.5 font-mono text-[9.5px] font-semibold tracking-wide uppercase ${
              r.kind === 'PR' ? 'bg-accent/20 text-accent-hover' : 'bg-surface-3 text-ink-subtle'
            }`}
          >
            {r.kind}
          </span>
          <span className="min-w-0 truncate text-[12.5px] text-ink-muted">{r.text}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-tertiary">{r.meta}</span>
        </div>
      ))}
    </div>
  );
}

function BentoTile({
  n,
  title,
  desc,
  className = '',
}: {
  n: string;
  title: string;
  desc: string;
  className?: string;
}) {
  return (
    <div className={`card-hover rounded-2xl border border-hairline bg-surface-1 p-6 ${className}`}>
      <span className="font-mono text-[13px] font-medium text-accent-hover">{n}</span>
      <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-subtle">{desc}</p>
    </div>
  );
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <div className="text-center">
      <p className="mb-3.5 inline-flex items-center gap-2 font-mono text-[12px] tracking-wider text-ink-tertiary uppercase">
        <span className="size-1 rounded-full bg-accent" />
        {eyebrow}
      </p>
      <h2 className="text-[clamp(27px,3.6vw,38px)] font-semibold tracking-[-0.025em] text-balance">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-subtle text-balance">
        {lead}
      </p>
    </div>
  );
}

function SetupCard({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-hover bg-canvas p-6">
      <h3 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold">
        <span className="rounded-md border border-hairline-strong bg-surface-1 px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-ink-muted uppercase">
          {tag}
        </span>
        {title}
      </h3>
      <ol className="list-decimal space-y-2.5 pl-4 text-[13.5px] leading-relaxed text-ink-subtle marker:text-ink-tertiary">
        {children}
      </ol>
    </div>
  );
}

function SetupLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent-hover underline underline-offset-2 hover:text-accent"
    >
      {children}
    </a>
  );
}

function Check() {
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/20">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2.5 6.5L5 9l4.5-5.5"
          stroke="var(--color-accent-hover)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
