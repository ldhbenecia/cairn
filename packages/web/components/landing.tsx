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
      <section className="relative overflow-hidden px-6 pt-28 pb-24 text-center sm:pt-36 sm:pb-32">
        <div
          className="aurora pointer-events-none absolute top-[-240px] left-1/2 -z-10 h-[600px] w-[920px] -translate-x-1/2 rounded-full opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent) 34%, transparent), transparent 64%)',
            filter: 'blur(48px)',
          }}
        />
        <div
          className="pointer-events-none absolute top-[-120px] left-[18%] -z-10 h-[420px] w-[520px] rounded-full opacity-60"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in srgb, #8b5cf6 30%, transparent), transparent 66%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="pointer-events-none absolute top-[-60px] right-[16%] -z-10 h-[380px] w-[460px] rounded-full opacity-50"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in srgb, #22d3ee 22%, transparent), transparent 68%)',
            filter: 'blur(64px)',
          }}
        />
        <div className="reveal mx-auto max-w-3xl">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-3.5 py-1.5 text-[13px] font-medium text-accent-hover transition-colors hover:bg-accent/15"
          >
            <span className="inline-block size-1.5 rounded-full bg-accent-hover" />
            {c.hero.badge}
          </a>
          <h1 className="text-[clamp(40px,7vw,72px)] leading-[1.02] font-semibold tracking-[-0.035em]">
            <span className="grad-text">{c.hero.h1a}</span>
            <br />
            {c.hero.h1b}
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-ink-subtle">
            {c.hero.lead}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={download}
              className="rounded-xl bg-accent px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-accent/40"
            >
              {c.hero.download}
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-hairline-strong px-6 py-3 text-[15px] font-semibold text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
            >
              {c.hero.source}
            </a>
          </div>
          <p className="mt-5 text-[13px] text-ink-tertiary">
            {latestTag ? `${latestTag} · ` : ''}
            {c.hero.sub}
          </p>
        </div>

        <div className="reveal mx-auto mt-20 max-w-4xl" style={{ animationDelay: '0.12s' }}>
          <Screenshot src="/statistics.png" alt="cairn statistics dashboard" priority />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead eyebrow={c.how.eyebrow} title={c.how.title} lead={c.how.lead} />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {c.how.steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.08}>
              <div className="card-hover h-full rounded-2xl border border-hairline bg-surface-1 p-7">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent/15 font-mono text-[15px] font-semibold text-accent-hover">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-[19px] font-semibold">{s.t}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-subtle">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* WORKLOG OUTPUT */}
      <section id="output" className="border-y border-hairline bg-surface-1/40">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
          <Reveal>
            <p className="mb-3 text-[13px] font-medium tracking-wide text-accent-hover uppercase">
              {c.output.eyebrow}
            </p>
            <h2 className="text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.02em]">
              {c.output.title}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-subtle">{c.output.lead}</p>
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
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <Reveal delay={0}>
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
          </Reveal>
          <Reveal delay={0.08}>
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
          </Reveal>
          <Reveal delay={0.16}>
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
          </Reveal>
        </div>
        <div className="mt-7 rounded-2xl border border-[#fbbf24]/25 bg-[#fbbf24]/[0.07] px-6 py-5 text-[14px] leading-relaxed text-[#e8c87a]">
          <strong className="text-[#fbbf24]">{c.setup.gatekeeperPre}</strong>
          {c.setup.gatekeeper}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#fbbf24]">
            xattr -d com.apple.quarantine /Applications/Cairn.app
          </code>
          {c.setup.gatekeeperPost}
        </div>
      </section>

      {/* DOWNLOAD CTA */}
      <section className="relative overflow-hidden px-6 py-28 text-center">
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[360px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent 68%)',
            filter: 'blur(50px)',
          }}
        />
        <h2 className="text-[clamp(30px,4.5vw,46px)] font-semibold tracking-[-0.025em]">
          {c.cta.title}
        </h2>
        <a
          href={download}
          className="mt-9 inline-block rounded-xl bg-accent px-7 py-3.5 text-[16px] font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-accent/40"
        >
          {c.cta.button}
        </a>
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
      <p className="mb-3 text-[13px] font-medium tracking-wide text-accent-hover uppercase">
        {eyebrow}
      </p>
      <h2 className="text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mx-auto mt-4 max-w-xl text-[16px] text-ink-subtle">{lead}</p>
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
    <div className="card-hover h-full rounded-2xl border border-hairline bg-surface-1 p-6">
      <h3 className="mb-4 flex items-center gap-2.5 text-[16px] font-semibold">
        <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-accent-hover uppercase">
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
