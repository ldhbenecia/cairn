import { content, type Lang } from '../lib/content';
import { getRepoStats, REPO_URL, RELEASES_LATEST } from '../lib/github';
import { BrandMark } from './brand-mark';
import { LangSwitcher } from './lang-switcher';
import { Nav } from './nav';
import { Reveal } from './reveal';
import { Screenshot } from './screenshot';

export async function Landing({ lang }: { lang: Lang }) {
  const c = content[lang];
  const { stars, latestTag, dmgUrl } = await getRepoStats();
  const download = dmgUrl ?? RELEASES_LATEST;

  return (
    <div id="top">
      <Nav stars={stars} lang={lang} />

      {/* HERO */}
      <section className="relative px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div className="reveal mx-auto max-w-3xl">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-hairline-strong bg-surface-1 py-1.5 pr-3.5 pl-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
          >
            <span className="size-1.5 rounded-full bg-accent" />
            {c.hero.badge}
          </a>
          <h1 className="text-[clamp(40px,7vw,68px)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance">
            {c.hero.h1a}
            <br />
            <span className="text-ink-subtle">{c.hero.h1b}</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[16.5px] leading-relaxed text-ink-subtle text-balance">
            {c.hero.lead}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
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
        </div>

        <div className="reveal mx-auto mt-18 max-w-5xl" style={{ animationDelay: '0.12s' }}>
          <Screenshot src="/statistics.png" alt="cairn statistics dashboard" priority />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead eyebrow={c.how.eyebrow} title={c.how.title} lead={c.how.lead} />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
          {c.how.steps.map((s, i) => (
            <div key={s.t} className="card-hover bg-canvas p-7">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] font-medium text-accent-hover">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.01em]">{s.t}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-subtle">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WORKLOG OUTPUT */}
      <section id="output" className="border-y border-hairline bg-surface-1/40">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
          <Reveal>
            <p className="mb-3.5 inline-flex items-center gap-2 font-mono text-[12px] tracking-wider text-ink-tertiary uppercase">
              <span className="size-1 rounded-full bg-accent" />
              {c.output.eyebrow}
            </p>
            <h2 className="text-[clamp(27px,3.6vw,38px)] font-semibold tracking-[-0.025em]">
              {c.output.title}
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-subtle">{c.output.lead}</p>
            <ul className="mt-7 space-y-3">
              {c.output.ticks.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] text-ink-muted">
                  <Check />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <Screenshot src="/worklog.png" alt="a published cairn worklog in Notion" />
          </Reveal>
        </div>
      </section>

      {/* SETUP */}
      <section id="setup" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead eyebrow={c.setup.eyebrow} title={c.setup.title} lead={c.setup.lead} />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
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
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4 text-[13.5px] leading-relaxed text-ink-subtle">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d4a574]" />
          <p>
            <strong className="font-medium text-ink-muted">{c.setup.gatekeeperPre}</strong>
            {c.setup.gatekeeper}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink-muted">
              xattr -d com.apple.quarantine /Applications/Cairn.app
            </code>
            {c.setup.gatekeeperPost}
          </p>
        </div>
      </section>

      {/* DOWNLOAD CTA */}
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
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <a href="#top" className="flex items-center gap-2 text-[14px] font-semibold">
            <BrandMark size={16} className="text-accent" />
            cairn
          </a>
          <div className="flex items-center gap-6 text-[14px] text-ink-subtle">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
            <a
              href={`${REPO_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              Releases
            </a>
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
