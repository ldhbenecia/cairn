import { AnimatePresence, motion } from 'framer-motion';
import { Check, ExternalLink, FolderPlus, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { NotionDb, NotionPage } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { useCloudAuth } from '../use-cloud-auth';
import { BrandMark } from './brand-mark';

type T = (key: I18nKey) => string;

type Status = 'idle' | 'testing' | 'ok' | 'err';

type TokenKind = 'notion' | 'github';

function tokenMismatchKey(kind: TokenKind, token: string): I18nKey | null {
  const t = token.trim();
  if (!t) return null;
  const looksNotion = t.startsWith('ntn_') || t.startsWith('secret_');
  const looksGithub = ['ghp_', 'github_pat_', 'gho_'].some((p) => t.startsWith(p));
  const looksAnthropic = t.startsWith('sk-ant-');
  if (kind === 'notion' && (looksGithub || looksAnthropic))
    return looksGithub ? 'onb.token.notionWrongGithub' : 'onb.token.wrongAnthropic';
  if (kind === 'github' && (looksNotion || looksAnthropic))
    return looksNotion ? 'onb.token.githubWrongNotion' : 'onb.token.wrongAnthropic';
  return null;
}

type NotionEntry = {
  label: string;
  token: string;
  status: Status;
  error?: string;
  persons: { id: string; name: string }[];
  personId: string;
  query: string;
  pages: NotionPage[];
  pageId: string;
  searching: boolean;
  searched: boolean;
  databases: NotionDb[];
  worklogDbId: string;
  rollupDbId: string;
};

type GithubEntry = { label: string; token: string; status: Status; error?: string; login?: string };

const STEPS = ['welcome', 'notion', 'github', 'claude', 'repos', 'review'] as const;
type Step = (typeof STEPS)[number];
const STEP_TITLE_KEY: Record<Step, I18nKey> = {
  welcome: 'onb.step.welcome',
  notion: 'onb.step.notion',
  github: 'onb.step.github',
  claude: 'onb.step.claude',
  repos: 'onb.step.repos',
  review: 'onb.step.review',
};

const newNotion = (label: string): NotionEntry => ({
  label,
  token: '',
  status: 'idle',
  persons: [],
  personId: '',
  query: '',
  pages: [],
  pageId: '',
  searching: false,
  searched: false,
  databases: [],
  worklogDbId: '',
  rollupDbId: '',
});

export function Onboarding({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { t, settings } = useSettings();
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx]!;
  const [notion, setNotion] = useState<NotionEntry[]>([newNotion('Personal')]);
  const [github, setGithub] = useState<GithubEntry[]>([
    { label: 'Personal', token: '', status: 'idle' },
  ]);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [repos, setRepos] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [finishErr, setFinishErr] = useState<string | null>(null);
  const [claudeStatus, setClaudeStatus] = useState<Status>('idle');
  const [ghImporting, setGhImporting] = useState(false);
  const [ghMsg, setGhMsg] = useState<I18nKey | null>(null);

  const patchNotion = (i: number, p: Partial<NotionEntry>) =>
    setNotion((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  const patchGithub = (i: number, p: Partial<GithubEntry>) =>
    setGithub((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...p } : e)));

  async function testNotion(i: number) {
    const e = notion[i]!;
    if (!e.token.trim()) return;
    patchNotion(i, { status: 'testing', error: undefined });
    const r = await window.cairn.onboarding.probeNotion(e.token.trim());
    if (!r.ok) {
      patchNotion(i, { status: 'err', error: r.error });
      return;
    }
    patchNotion(i, {
      status: 'ok',
      persons: r.persons,
      personId: r.persons.length === 1 ? r.persons[0]!.id : '',
    });
    void searchPages(i);
  }

  async function searchPages(i: number) {
    const e = notion[i]!;
    patchNotion(i, { searching: true });
    try {
      const pages = await window.cairn.onboarding.searchNotion(e.token.trim(), e.query);
      patchNotion(i, { pages, searched: true });
    } finally {
      patchNotion(i, { searching: false });
    }
  }

  async function loadDatabases(i: number, pageId: string) {
    const e = notion[i]!;
    const dbs = await window.cairn.onboarding.listDatabases(e.token.trim(), pageId);
    patchNotion(i, { databases: dbs });
  }

  async function testGithub(i: number) {
    const e = github[i]!;
    if (!e.token.trim()) return;
    patchGithub(i, { status: 'testing', error: undefined });
    const r = await window.cairn.onboarding.probeGithub(e.token.trim());
    patchGithub(i, r.ok ? { status: 'ok', login: r.login } : { status: 'err', error: r.error });
  }

  async function importFromGh() {
    setGhImporting(true);
    setGhMsg(null);
    try {
      const r = await window.cairn.onboarding.githubFromGhCli();
      if (!r.ok || !r.accounts?.length) {
        setGhMsg(r.error === 'gh-not-found' ? 'onb.github.ghNotFound' : 'onb.github.ghNotAuthed');
        return;
      }
      const entries: GithubEntry[] = r.accounts.map((a) => ({
        label: a.login,
        token: a.token,
        status: 'testing',
      }));
      setGithub(entries);
      await Promise.all(
        entries.map(async (entry, i) => {
          const probe = await window.cairn.onboarding.probeGithub(entry.token);
          patchGithub(
            i,
            probe.ok ? { status: 'ok', login: probe.login } : { status: 'err', error: probe.error },
          );
        }),
      );
    } catch {
      setGhMsg('onb.github.ghNotAuthed');
    } finally {
      setGhImporting(false);
    }
  }

  const notionValid = notion.some((e) => e.status === 'ok' && e.pageId && e.personId);

  async function finish() {
    setFinishing(true);
    setFinishErr(null);
    const r = await window.cairn.onboarding.finish({
      notion: notion
        .filter((e) => e.status === 'ok' && e.pageId && e.personId)
        .map((e) => {
          const worklogDb = e.databases.find((d) => d.databaseId === e.worklogDbId);
          const rollupDb = e.databases.find((d) => d.databaseId === e.rollupDbId);
          return {
            label: e.label,
            token: e.token.trim(),
            pageId: e.pageId,
            myUserId: e.personId,
            worklogDb: worklogDb
              ? { databaseId: worklogDb.databaseId, dataSourceId: worklogDb.dataSourceId }
              : undefined,
            rollupDb: rollupDb
              ? { databaseId: rollupDb.databaseId, dataSourceId: rollupDb.dataSourceId }
              : undefined,
          };
        }),
      github: github
        .filter((e) => e.status === 'ok' && e.token.trim())
        .map((e) => ({ label: e.label, token: e.token.trim() })),
      anthropicApiKey: anthropicKey.trim() || undefined,
      localGitRepos: repos,
    });
    setFinishing(false);
    if (r.ok) onDone();
    else setFinishErr(r.error ?? 'failed');
  }

  async function testClaude() {
    setClaudeStatus('testing');
    const r = await window.cairn.onboarding.probeClaude();
    setClaudeStatus(r.ok ? 'ok' : 'err');
  }

  useEffect(() => {
    if (step === 'claude' && claudeStatus === 'idle') void testClaude();
  }, [step]);

  async function addRepo() {
    const p = await window.cairn.onboarding.pickFolder();
    if (p && !repos.includes(p)) setRepos((prev) => [...prev, p]);
  }

  const canNext = step === 'notion' ? notionValid : true;

  return (
    <div className="panel-enter flex h-screen w-screen flex-col bg-canvas text-ink">
      <div className="h-11 shrink-0 [-webkit-app-region:drag]" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden px-8">
        <div className="flex items-center gap-2.5 pb-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-white">
            <BrandMark size={17} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.3px]">cairn</span>
          {step !== 'welcome' && (
            <span className="ml-auto text-[12px] text-ink-tertiary">
              {stepIdx} / {STEPS.length - 1} · {t(STEP_TITLE_KEY[step])}
            </span>
          )}
        </div>
        {step !== 'welcome' && (
          <div className="flex items-center gap-1.5 pb-5">
            {STEPS.slice(1).map((s, i) => (
              <span
                key={s}
                className={[
                  'h-1 rounded-full transition-all duration-300',
                  i === stepIdx - 1
                    ? 'w-6 bg-accent'
                    : i < stepIdx - 1
                      ? 'w-3 bg-accent/45'
                      : 'w-3 bg-surface-3',
                ].join(' ')}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 overflow-y-auto [scrollbar-gutter:stable]"
          >
            {step === 'welcome' && <Welcome t={t} />}
            {step === 'notion' && (
              <Section
                desc={t('onb.notion.desc')}
                links={[
                  { label: t('onb.notion.link'), url: 'https://www.notion.so/my-integrations' },
                ]}
              >
                <a
                  href="https://cairnlog.cloud/setup/notion"
                  onClick={(ev) => {
                    ev.preventDefault();
                    void window.cairn.openExternal(
                      `https://cairnlog.cloud${settings.language === 'ko' ? '/ko' : ''}/setup/notion`,
                    );
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-[13px] text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
                >
                  <span>{t('onb.notion.webGuide')}</span>
                  <ExternalLink size={14} strokeWidth={2} className="shrink-0 text-ink-tertiary" />
                </a>
                {notion.map((e, i) => (
                  <NotionCard
                    key={i}
                    e={e}
                    onChange={(p) => patchNotion(i, p)}
                    onTest={() => void testNotion(i)}
                    onSearch={() => void searchPages(i)}
                    onSelectPage={(pageId) => {
                      patchNotion(i, { pageId, worklogDbId: '', rollupDbId: '' });
                      void loadDatabases(i, pageId);
                    }}
                    onRemove={
                      notion.length > 1
                        ? () => setNotion((p) => p.filter((_, x) => x !== i))
                        : undefined
                    }
                  />
                ))}
                <AddButton
                  label={t('onb.notion.add')}
                  onClick={() => setNotion((p) => [...p, newNotion(`Workspace ${p.length + 1}`)])}
                />
              </Section>
            )}
            {step === 'github' && (
              <Section
                desc={t('onb.github.desc')}
                links={[
                  {
                    label: t('onb.github.linkClassic'),
                    url: 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=cairn%20worklog',
                  },
                  {
                    label: t('onb.github.linkFine'),
                    url: 'https://github.com/settings/personal-access-tokens/new',
                  },
                ]}
              >
                <div className="rounded-lg border border-accent/30 bg-accent/[0.06] p-3.5">
                  <p className="mb-0.5 text-[13px] font-medium text-ink">
                    {t('onb.github.ghTitle')}
                  </p>
                  <p className="mb-2.5 text-[12px] leading-relaxed text-ink-subtle">
                    {t('onb.github.ghBody')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void importFromGh()}
                    disabled={ghImporting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    {ghImporting ? t('onb.github.ghImporting') : t('onb.github.ghImport')}
                  </button>
                  {ghMsg && <p className="mt-2 text-[12px] text-[#f87171]">{t(ghMsg)}</p>}
                </div>
                <div className="flex items-center gap-2.5 py-0.5">
                  <span className="h-px flex-1 bg-hairline" />
                  <span className="text-[11px] text-ink-tertiary">{t('onb.github.orManual')}</span>
                  <span className="h-px flex-1 bg-hairline" />
                </div>
                <div className="rounded-lg border border-hairline bg-surface-1 p-3.5 text-[12px] leading-relaxed text-ink-subtle">
                  <p className="mb-1.5 text-[13px] font-medium text-ink-muted">
                    {t('onb.github.fineTitle')}
                  </p>
                  <p>{t('onb.github.fineRepo')}</p>
                  <p>{t('onb.github.finePerms')}</p>
                  <p className="mt-1.5 text-ink-tertiary">{t('onb.github.fineMix')}</p>
                  <p className="text-ink-tertiary">{t('onb.github.fineExample')}</p>
                </div>
                {github.map((e, i) => (
                  <GithubCard
                    key={i}
                    e={e}
                    onChange={(p) => patchGithub(i, p)}
                    onTest={() => void testGithub(i)}
                    onRemove={
                      github.length > 1
                        ? () => setGithub((p) => p.filter((_, x) => x !== i))
                        : undefined
                    }
                  />
                ))}
                <AddButton
                  label={t('onb.github.add')}
                  onClick={() =>
                    setGithub((p) => [
                      ...p,
                      { label: `Account ${p.length + 1}`, token: '', status: 'idle' },
                    ])
                  }
                />
              </Section>
            )}
            {step === 'claude' && (
              <Section desc={t('onb.claude.desc')}>
                <div className="rounded-lg border border-hairline bg-surface-1 p-4 text-[13px] leading-relaxed text-ink-muted">
                  <p className="mb-2 font-medium text-ink">{t('onb.claude.autoTitle')}</p>
                  <p className="text-ink-subtle">{t('onb.claude.autoBody')}</p>
                  <button
                    type="button"
                    onClick={() =>
                      void window.cairn.openExternal(
                        'https://docs.claude.com/en/docs/claude-code/setup',
                      )
                    }
                    className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
                  >
                    <ExternalLink size={11} strokeWidth={2} /> {t('onb.claude.install')}
                  </button>
                </div>
                <div>
                  <p className="mb-1.5 text-[13px] text-ink-muted">{t('onb.claude.orApiKey')}</p>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(ev) => setAnthropicKey(ev.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void window.cairn.openExternal('https://console.anthropic.com/settings/keys')
                    }
                    className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
                  >
                    <ExternalLink size={11} strokeWidth={2} /> {t('onb.claude.issueKey')}
                  </button>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void testClaude()}
                    disabled={claudeStatus === 'testing'}
                    className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    {claudeStatus === 'testing' && (
                      <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                    )}
                    {t('onb.claude.test')}
                  </button>
                  {claudeStatus === 'ok' && (
                    <span className="inline-flex items-center gap-1 text-[13px] text-success">
                      <Check size={14} strokeWidth={2.5} /> {t('onb.claude.connected')}
                    </span>
                  )}
                  {claudeStatus === 'err' && (
                    <span className="text-[13px] text-[#f87171]">{t('onb.claude.failed')}</span>
                  )}
                  {claudeStatus === 'testing' && (
                    <span className="text-[12px] text-ink-tertiary">{t('onb.claude.testing')}</span>
                  )}
                </div>
              </Section>
            )}
            {step === 'repos' && (
              <Section desc={t('onb.repos.desc')}>
                <div className="flex flex-col gap-2">
                  {repos.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 py-2 text-[13px]"
                    >
                      <span className="flex-1 truncate font-mono text-ink-muted">{r}</span>
                      <button
                        type="button"
                        onClick={() => setRepos((p) => p.filter((_, x) => x !== i))}
                        className="text-ink-tertiary hover:text-ink"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
                <AddButton
                  icon={FolderPlus}
                  label={t('onb.repos.add')}
                  onClick={() => void addRepo()}
                />
              </Section>
            )}
            {step === 'review' && (
              <Section desc={t('onb.review.desc')}>
                <ul className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
                  <li>
                    {t('onb.review.notion')}{' '}
                    {notion.filter((e) => e.status === 'ok' && e.pageId).length}
                  </li>
                  <li>
                    {t('onb.review.github')} {github.filter((e) => e.status === 'ok').length}
                  </li>
                  <li>
                    {t('onb.review.claude')}{' '}
                    {anthropicKey.trim()
                      ? t('onb.review.claudeApiKey')
                      : t('onb.review.claudeAuto')}
                  </li>
                  <li>
                    {t('onb.review.repos')} {repos.length}
                  </li>
                </ul>
                {claudeStatus !== 'ok' && !anthropicKey.trim() && (
                  <div className="rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/10 p-3 text-[12px] leading-relaxed text-[#fbbf24]">
                    {t('onb.review.warnNoClaude')}
                  </div>
                )}
                {finishErr && (
                  <p className="text-[13px] text-[#f87171]">
                    {t('onb.review.failPrefix')}: {finishErr}
                  </p>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 items-center gap-2 border-t border-hairline py-4">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => setStepIdx((s) => s - 1)}
              className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {t('onb.nav.prev')}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-2 text-[13px] text-ink-tertiary hover:text-ink-muted"
            >
              {t('onb.nav.cancel')}
            </button>
          )}
          <div className="ml-auto">
            {step === 'review' ? (
              <button
                type="button"
                disabled={finishing || !notionValid}
                onClick={() => void finish()}
                className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {finishing && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
                {t('onb.nav.start')}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStepIdx((s) => s + 1)}
                className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {t('onb.nav.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SLOW = [0.22, 1, 0.36, 1] as const;
const RISE = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: SLOW } },
};
const BRAND_IN = {
  hidden: { opacity: 0, scale: 0.8, filter: 'blur(10px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 1.3, ease: SLOW } },
};

function Welcome({ t }: { t: T }) {
  const { signedIn, user } = useCloudAuth();
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.32, delayChildren: 0.35 } } }}
      className="flex h-full flex-col items-center justify-center gap-7 pb-6 text-center"
    >
      <motion.span
        variants={BRAND_IN}
        className="flex size-20 items-center justify-center rounded-[20px] bg-accent text-white shadow-xl shadow-accent/30"
      >
        <BrandMark size={42} />
      </motion.span>
      <motion.div variants={RISE} className="flex flex-col gap-2.5">
        <h1 className="text-[28px] font-semibold tracking-[-0.6px]">{t('onb.welcome.title')}</h1>
        <p className="mx-auto max-w-md text-[14px] leading-relaxed text-ink-muted">
          {t('onb.welcome.desc')}
        </p>
      </motion.div>
      <motion.ul variants={RISE} className="flex flex-col gap-1.5 text-[13px] text-ink-subtle">
        <li>
          <span className="text-ink-muted">Notion</span> — {t('onb.welcome.notion')}
        </li>
        <li>
          <span className="text-ink-muted">GitHub</span> — {t('onb.welcome.github')}
        </li>
        <li>
          <span className="text-ink-muted">Claude</span> — {t('onb.welcome.claude')}
        </li>
      </motion.ul>
      <motion.div
        variants={RISE}
        className="w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-4 text-left"
      >
        {signedIn && user ? (
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <Check size={15} className="shrink-0 text-emerald-500" />
            {t('onb.welcome.signedInAs').replace('{email}', user.email)}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12.5px] leading-relaxed text-ink-subtle">
              {t('onb.welcome.syncNote')}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void window.cairn.cloud.signIn().catch(() => {})}
                className="rounded-md border border-hairline-strong bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
              >
                {t('account.signIn')}
              </button>
              <span className="text-[12px] text-ink-tertiary">{t('onb.welcome.optional')}</span>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Section({
  desc,
  links,
  children,
}: {
  desc: string;
  links?: { label: string; url: string }[];
  children: React.ReactNode;
}) {
  const all = links ?? [];
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-[13px] leading-relaxed text-ink-muted">{desc}</p>
      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {all.map((l) => (
            <button
              key={l.url}
              type="button"
              onClick={() => void window.cairn.openExternal(l.url)}
              className="inline-flex w-fit items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
            >
              <ExternalLink size={11} strokeWidth={2} /> {l.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function AddButton({
  label,
  onClick,
  icon: Icon = Plus,
}: {
  label: string;
  onClick: () => void;
  icon?: typeof Plus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-hairline-strong px-3 py-2 text-[13px] text-ink-subtle hover:bg-surface-2 hover:text-ink"
    >
      <Icon size={14} strokeWidth={2} /> {label}
    </button>
  );
}

function StatusDot({ status }: { status: Status }) {
  if (status === 'testing')
    return <Loader2 size={14} strokeWidth={2} className="animate-spin text-accent" />;
  if (status === 'ok') return <Check size={14} strokeWidth={2.5} className="text-success" />;
  return null;
}

function LabelToken({
  kind,
  label,
  token,
  status,
  onChange,
  onTest,
  onRemove,
}: {
  kind: TokenKind;
  label: string;
  token: string;
  status: Status;
  onChange: (p: { label?: string; token?: string }) => void;
  onTest: () => void;
  onRemove?: () => void;
}) {
  const { t } = useSettings();
  const mismatchKey = tokenMismatchKey(kind, token);
  const onTestRef = useRef(onTest);
  onTestRef.current = onTest;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!token.trim() || mismatchKey) return;
    const id = setTimeout(() => onTestRef.current(), 800);
    return () => clearTimeout(id);
  }, [token]);

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={t('onb.field.labelPh')}
          className="w-24 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 text-[13px] text-ink focus:border-accent/60 focus:outline-none"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => onChange({ token: e.target.value })}
          placeholder={t('onb.field.tokenPh')}
          className="flex-1 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={onTest}
          disabled={!token.trim() || status === 'testing' || !!mismatchKey}
          className="shrink-0 rounded-md border border-hairline px-2.5 py-2 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          {t('onb.field.test')}
        </button>
        <StatusDot status={status} />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-ink-tertiary hover:text-ink"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {mismatchKey && <p className="text-[12px] text-[#fbbf24]">{t(mismatchKey)}</p>}
    </>
  );
}

function NotionCard({
  e,
  onChange,
  onTest,
  onSearch,
  onSelectPage,
  onRemove,
}: {
  e: NotionEntry;
  onChange: (p: Partial<NotionEntry>) => void;
  onTest: () => void;
  onSearch: () => void;
  onSelectPage: (pageId: string) => void;
  onRemove?: () => void;
}) {
  const { t } = useSettings();
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface-1 p-3">
      <LabelToken
        kind="notion"
        label={e.label}
        token={e.token}
        status={e.status}
        onChange={onChange}
        onTest={onTest}
        onRemove={onRemove}
      />
      {e.status === 'err' && <p className="text-[12px] text-[#f87171]">{e.error}</p>}
      {e.status === 'ok' && (
        <>
          {e.persons.length > 1 && (
            <select
              value={e.personId}
              onChange={(ev) => onChange({ personId: ev.target.value })}
              className="rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-[13px] text-ink"
            >
              <option value="">{t('onb.notion.selectAccount')}</option>
              {e.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <input
              value={e.query}
              onChange={(ev) => onChange({ query: ev.target.value })}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') onSearch();
              }}
              placeholder={t('onb.notion.searchPh')}
              className="flex-1 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={onSearch}
              disabled={e.searching}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              {e.searching ? (
                <Loader2 size={12} strokeWidth={2} className="animate-spin" />
              ) : (
                <Search size={12} strokeWidth={2} />
              )}
              {t('onb.notion.search')}
            </button>
          </div>
          {e.pages.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-hairline [scrollbar-gutter:stable]">
              {e.pages.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => onSelectPage(pg.id)}
                  className={[
                    'flex w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-surface-2',
                    e.pageId === pg.id ? 'text-ink' : 'text-ink-muted',
                  ].join(' ')}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {e.pageId === pg.id && (
                      <Check size={13} strokeWidth={2.5} className="text-accent" />
                    )}
                  </span>
                  <span className="truncate">{pg.title}</span>
                </button>
              ))}
            </div>
          )}
          {e.searched && !e.searching && e.pages.length === 0 && (
            <p className="text-[12px] leading-relaxed text-ink-tertiary">
              {t('onb.notion.searchEmpty')}
            </p>
          )}
          {e.pageId && e.databases.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[12px] text-ink-tertiary">{t('onb.notion.dbHint')}</p>
              <div className="flex gap-2">
                <select
                  value={e.worklogDbId}
                  onChange={(ev) => onChange({ worklogDbId: ev.target.value })}
                  className="flex-1 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink"
                >
                  <option value="">{t('onb.notion.worklogAuto')}</option>
                  {e.databases.map((d) => (
                    <option key={d.databaseId} value={d.databaseId}>
                      {t('onb.notion.worklogPrefix')}: {d.title}
                    </option>
                  ))}
                </select>
                <select
                  value={e.rollupDbId}
                  onChange={(ev) => onChange({ rollupDbId: ev.target.value })}
                  className="flex-1 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink"
                >
                  <option value="">{t('onb.notion.rollupAuto')}</option>
                  {e.databases.map((d) => (
                    <option key={d.databaseId} value={d.databaseId}>
                      {t('onb.notion.rollupPrefix')}: {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GithubCard({
  e,
  onChange,
  onTest,
  onRemove,
}: {
  e: GithubEntry;
  onChange: (p: Partial<GithubEntry>) => void;
  onTest: () => void;
  onRemove?: () => void;
}) {
  const { t } = useSettings();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
      <LabelToken
        kind="github"
        label={e.label}
        token={e.token}
        status={e.status}
        onChange={onChange}
        onTest={onTest}
        onRemove={onRemove}
      />
      {e.status === 'err' && <p className="text-[12px] text-[#f87171]">{e.error}</p>}
      {e.status === 'ok' && e.login && (
        <p className="text-[12px] text-ink-subtle">
          @{e.login} {t('onb.github.connected')}
        </p>
      )}
    </div>
  );
}
