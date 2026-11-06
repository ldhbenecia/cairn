import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ExternalLink,
  FolderPlus,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SUMMARY_PROVIDERS, type SummaryProvider } from '../../../shared/ipc-types';
import { PROVIDER_NAME } from '../../../shared/summary-provider';
import type { I18nKey } from '../i18n';
import { useEngineLoggedIn } from '../lib/engine-auth';
import { useSettings } from '../settings-context';
import { useCloudAuth } from '../use-cloud-auth';
import { BrandMark } from './brand-mark';
import { ClaudeMark, CodexMark } from './brand-icons';
import { EngineLoginButton, EngineLoginPanel, useEngineLogin } from './engine-login';
import { GithubCard } from './onboarding-cards';
import type { GithubEntry, Status } from './onboarding-cards';

type T = (key: I18nKey) => string;

const STEPS = ['welcome', 'github', 'engine', 'repos', 'review'] as const;
type Step = (typeof STEPS)[number];
const STEP_TITLE_KEY: Record<Step, I18nKey> = {
  welcome: 'onb.step.welcome',
  github: 'onb.step.github',
  engine: 'onb.step.engine',
  repos: 'onb.step.repos',
  review: 'onb.step.review',
};

export function Onboarding({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { settings, update, t } = useSettings();
  const provider = settings.summaryProvider;
  // onCancel 존재 = 설정에서 진입한 재설정 — 환영 스텝을 건너뛰고 문구도 재설정 톤
  const reconfigure = !!onCancel;
  const [stepIdx, setStepIdx] = useState(reconfigure ? 1 : 0);
  const step = STEPS[stepIdx]!;
  const [github, setGithub] = useState<GithubEntry[]>([
    { label: 'Personal', token: '', status: 'idle' },
  ]);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [repos, setRepos] = useState<string[]>([]);
  const [repoWarns, setRepoWarns] = useState<Record<string, 'not-git' | 'no-email'>>({});
  const [finishing, setFinishing] = useState(false);
  const [finishErr, setFinishErr] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<Status>('idle');
  const [ghImporting, setGhImporting] = useState(false);
  const [ghMsg, setGhMsg] = useState<I18nKey | null>(null);

  const patchGithub = (i: number, p: Partial<GithubEntry>) =>
    setGithub((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...p } : e)));

  // 프로브 결과는 index 가 아닌 token 으로 적용 — 프로브 중 계정을 제거·수정하면 index 가 밀려
  // 엉뚱한 항목에 찍힘, token 이 안 맞으면 결과 폐기
  const patchGithubByToken = (token: string, p: Partial<GithubEntry>) =>
    setGithub((prev) => prev.map((e) => (e.token.trim() === token ? { ...e, ...p } : e)));

  const patchGithubByGhLogin = (ghLogin: string, p: Partial<GithubEntry>) =>
    setGithub((prev) => prev.map((e) => (e.ghLogin === ghLogin ? { ...e, ...p } : e)));

  async function testGithub(i: number) {
    const entry = github[i]!;
    if (entry.ghLogin) {
      const ghLogin = entry.ghLogin;
      patchGithubByGhLogin(ghLogin, { status: 'testing', error: undefined });
      const r = await window.cairn.onboarding.probeGithubGh(ghLogin);
      patchGithubByGhLogin(
        ghLogin,
        r.ok ? { status: 'ok', login: r.login } : { status: 'err', error: r.error },
      );
      return;
    }
    const token = entry.token.trim();
    if (!token) return;
    patchGithubByToken(token, { status: 'testing', error: undefined });
    const r = await window.cairn.onboarding.probeGithub(token);
    patchGithubByToken(
      token,
      r.ok ? { status: 'ok', login: r.login } : { status: 'err', error: r.error },
    );
  }

  async function importFromGh() {
    setGhImporting(true);
    setGhMsg(null);
    try {
      const r = await window.cairn.onboarding.githubFromGhCli();
      if (!r.ok || !r.logins?.length) {
        setGhMsg(r.error === 'gh-not-found' ? 'onb.github.ghNotFound' : 'onb.github.ghNotAuthed');
        return;
      }
      const entries: GithubEntry[] = r.logins.map((login) => ({
        label: login,
        token: '',
        ghLogin: login,
        status: 'testing',
      }));
      setGithub(entries);
      const probed = await Promise.all(
        entries.map(async (entry): Promise<GithubEntry> => {
          try {
            const probe = await window.cairn.onboarding.probeGithubGh(entry.ghLogin!);
            return probe.ok
              ? { ...entry, status: 'ok', login: probe.login }
              : { ...entry, status: 'err', error: probe.error };
          } catch {
            return { ...entry, status: 'err', error: 'failed' };
          }
        }),
      );
      setGithub(probed);
    } catch {
      setGhMsg('onb.github.ghNotAuthed');
    } finally {
      setGhImporting(false);
    }
  }

  // 최소 요건: 활동 소스(GitHub 계정 또는 로컬 Git 레포) 하나 + 요약 엔진 — 노션은 Preferences 연동 탭에서
  const sourceValid =
    repos.length > 0 || github.some((e) => e.status === 'ok' && (e.token.trim() || e.ghLogin));
  // API key 는 Claude 전용, Codex 는 CLI 로그인만
  const apiKey = provider === 'claude' ? anthropicKey.trim() : '';
  const engineValid = engineStatus === 'ok' || !!apiKey;

  async function finish() {
    setFinishing(true);
    setFinishErr(null);
    const r = await window.cairn.onboarding.finish({
      notion: [],
      github: github
        .filter((e) => e.status === 'ok' && (e.token.trim() || e.ghLogin))
        .map((e) =>
          e.ghLogin
            ? { label: e.label, ghLogin: e.ghLogin }
            : { label: e.label, token: e.token.trim() },
        ),
      anthropicApiKey: apiKey || undefined,
      localGitRepos: repos,
    });
    setFinishing(false);
    if (r.ok) onDone();
    else setFinishErr(r.error ?? 'failed');
  }

  async function testEngine() {
    setEngineStatus('testing');
    const r = await window.cairn.onboarding.probeClaude();
    setEngineStatus(r.ok ? 'ok' : 'err');
  }

  // 설정 쓰기 IPC 가 동기 처리라 뒤이은 probe 는 바뀐 엔진으로 실행됨
  function selectEngine(p: SummaryProvider) {
    if (p === provider) return;
    update({ summaryProvider: p });
    setEngineStatus('idle');
  }

  // probe 실패 원인이 로그아웃일 때만 앱 안 로그인 버튼 노출
  const { loggedIn, refresh: refreshLoggedIn } = useEngineLoggedIn(
    provider,
    step === 'engine' && engineStatus === 'err',
  );
  const engineLogin = useEngineLogin(provider, () => {
    refreshLoggedIn();
    void testEngine();
  });

  useEffect(() => {
    // 엔진 스텝 첫 진입 시 1회 자동 확인 (idle 가드로 멱등)
    if (step === 'engine' && engineStatus === 'idle') void testEngine();
  }, [step, engineStatus]);

  async function addRepo() {
    const p = await window.cairn.onboarding.pickFolder();
    if (!p || repos.includes(p)) return;
    setRepos((prev) => [...prev, p]);
    // 경고만, 차단 안 함
    const probe = await window.cairn.onboarding.probeRepo(p);
    if (!probe.ok && probe.reason) {
      setRepoWarns((prev) => ({ ...prev, [p]: probe.reason! }));
    }
  }

  return (
    <div className="panel-enter flex h-screen w-screen flex-col bg-canvas text-ink">
      <div className="h-11 shrink-0 [-webkit-app-region:drag]" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden px-8">
        <div className="flex items-center gap-2.5 pb-3">
          <BrandMark size={18} className="shrink-0 text-ink" />
          <span className="text-[17px] font-semibold tracking-[-0.3px]">cairn</span>
          {reconfigure && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              {t('onb.reconfigure')}
            </span>
          )}
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
                  'h-1 rounded-full transition-[width,background-color] duration-300',
                  i === stepIdx - 1
                    ? 'w-6 bg-ink/80'
                    : i < stepIdx - 1
                      ? 'w-3 bg-ink/30'
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
            {step === 'github' && (
              <Section
                desc={t('onb.github.desc')}
                links={[
                  {
                    label: t('onb.github.linkFine'),
                    url: 'https://github.com/settings/personal-access-tokens/new',
                  },
                  {
                    label: t('onb.github.linkClassic'),
                    url: 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=cairn%20worklog',
                  },
                ]}
              >
                <div className="relative overflow-hidden rounded-lg border border-hairline-strong bg-surface-1 p-3.5">
                  <span className="absolute inset-x-0 top-0 h-px bg-ink/25" />
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
                    className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-canvas transition-[background-color,scale] hover:bg-ink/90 active:scale-[0.96] disabled:opacity-60"
                  >
                    {ghImporting ? t('onb.github.ghImporting') : t('onb.github.ghImport')}
                  </button>
                  {ghMsg && <p className="mt-2 text-[12px] text-danger">{t(ghMsg)}</p>}
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
            {step === 'engine' && (
              <Section desc={t('onb.engine.desc')}>
                <div className="grid grid-cols-2 gap-2">
                  {SUMMARY_PROVIDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => selectEngine(p)}
                      aria-pressed={provider === p}
                      className={[
                        'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-colors',
                        provider === p
                          ? 'border-ink/40 bg-surface-2 text-ink'
                          : 'border-hairline bg-surface-1 text-ink-muted hover:bg-surface-2 hover:text-ink',
                      ].join(' ')}
                    >
                      {p === 'codex' ? <CodexMark size={14} /> : <ClaudeMark size={14} />}
                      <span className="font-medium">{PROVIDER_NAME[p]}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-hairline bg-surface-1 p-4 text-[13px] leading-relaxed text-ink-muted">
                  <p className="mb-2 font-medium text-ink">
                    {t(provider === 'codex' ? 'onb.codex.autoTitle' : 'onb.claude.autoTitle')}
                  </p>
                  <p className="text-ink-subtle">
                    {t(provider === 'codex' ? 'onb.codex.autoBody' : 'onb.claude.autoBody')}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void window.cairn.openExternal(
                        provider === 'codex'
                          ? 'https://developers.openai.com/codex/cli'
                          : 'https://docs.claude.com/en/docs/claude-code/setup',
                      )
                    }
                    className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
                  >
                    <ExternalLink size={11} strokeWidth={2} />{' '}
                    {t(provider === 'codex' ? 'onb.codex.install' : 'onb.claude.install')}
                  </button>
                </div>
                {provider === 'claude' && (
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
                        void window.cairn.openExternal(
                          'https://console.anthropic.com/settings/keys',
                        )
                      }
                      className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
                    >
                      <ExternalLink size={11} strokeWidth={2} /> {t('onb.claude.issueKey')}
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void testEngine()}
                    disabled={engineStatus === 'testing'}
                    className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    {engineStatus === 'testing' && (
                      <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                    )}
                    {t('onb.engine.test')}
                  </button>
                  {engineStatus === 'ok' && (
                    <span className="inline-flex items-center gap-1 text-[13px] text-success">
                      <Check size={14} strokeWidth={2.5} /> {t('onb.engine.connected')}
                    </span>
                  )}
                  {engineStatus === 'err' && (
                    <span className="text-[13px] text-danger">
                      {t(provider === 'codex' ? 'onb.codex.failed' : 'onb.claude.failed')}
                    </span>
                  )}
                  {engineStatus === 'err' && loggedIn === false && (
                    <EngineLoginButton login={engineLogin} />
                  )}
                  {engineStatus === 'testing' && (
                    <span className="text-[12px] text-ink-tertiary">{t('onb.engine.testing')}</span>
                  )}
                </div>
                {engineLogin.state !== 'idle' && <EngineLoginPanel login={engineLogin} />}
              </Section>
            )}
            {step === 'repos' && (
              <Section desc={t('onb.repos.desc')}>
                <div className="flex flex-col gap-2">
                  {repos.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-hairline bg-surface-1 px-3 py-2 text-[13px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-mono text-ink-muted">{r}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRepos((p) => p.filter((_, x) => x !== i));
                            setRepoWarns((prev) =>
                              Object.fromEntries(Object.entries(prev).filter(([k]) => k !== r)),
                            );
                          }}
                          aria-label={t('onb.field.remove')}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                      {repoWarns[r] && (
                        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-warning">
                          <TriangleAlert size={12} strokeWidth={2} className="shrink-0" />
                          {t(repoWarns[r] === 'not-git' ? 'onb.repos.notGit' : 'onb.repos.noEmail')}
                        </p>
                      )}
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
                    {t('onb.review.github')} {github.filter((e) => e.status === 'ok').length}
                  </li>
                  <li>
                    {t('onb.review.engine')} {PROVIDER_NAME[provider]} ·{' '}
                    {apiKey ? t('onb.review.engineApiKey') : t('onb.review.engineAuto')}
                  </li>
                  <li>
                    {t('onb.review.repos')} {repos.length}
                  </li>
                  <li className="text-ink-tertiary">{t('onb.review.notionLater')}</li>
                </ul>
                {!sourceValid && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-[12px] leading-relaxed text-warning">
                    {t('onb.review.needSource')}
                  </div>
                )}
                {!engineValid && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-[12px] leading-relaxed text-warning">
                    {t('onb.review.warnNoEngine')}
                  </div>
                )}
                {finishErr && (
                  <p className="text-[13px] text-danger">
                    {t('onb.review.failPrefix')}: {finishErr}
                  </p>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 items-center gap-2 border-t border-hairline py-4">
          {stepIdx > (reconfigure ? 1 : 0) && (
            <button
              type="button"
              onClick={() => setStepIdx((s) => s - 1)}
              className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
                disabled={finishing || !sourceValid || !engineValid}
                onClick={() => void finish()}
                className="flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-canvas transition-[background-color,scale] hover:bg-ink/90 active:scale-[0.96] disabled:opacity-50"
              >
                {finishing && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
                {t('onb.nav.start')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIdx((s) => s + 1)}
                className="rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-canvas transition-[background-color,scale] hover:bg-ink/90 active:scale-[0.96] disabled:opacity-50"
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
function Welcome({ t }: { t: T }) {
  const { signedIn, user } = useCloudAuth();
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.32, delayChildren: 0.35 } } }}
      className="flex h-full flex-col items-center justify-center gap-7 pb-6 text-center"
    >
      <motion.span variants={RISE} className="text-ink">
        <BrandMark size={52} />
      </motion.span>
      <motion.div variants={RISE} className="flex flex-col gap-2.5">
        <h1 className="text-[28px] font-semibold tracking-[-0.6px]">{t('onb.welcome.title')}</h1>
        <p className="mx-auto max-w-md text-[14px] leading-relaxed text-ink-muted">
          {t('onb.welcome.desc')}
        </p>
      </motion.div>
      <motion.ul variants={RISE} className="flex flex-col gap-1.5 text-[13px] text-ink-subtle">
        <li>
          <span className="text-ink-muted">GitHub</span> — {t('onb.welcome.github')}
        </li>
        <li>
          <span className="text-ink-muted">Claude · Codex</span> — {t('onb.welcome.engine')}
        </li>
      </motion.ul>
      <motion.div
        variants={RISE}
        className="w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-4 text-left"
      >
        {signedIn && user ? (
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <Check size={15} className="shrink-0 text-success" />
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
