import { useState } from 'react';
import { Check, ExternalLink, FolderPlus, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import type { NotionPage } from '../cairn-api';
import { BrandMark } from './brand-mark';

type Status = 'idle' | 'testing' | 'ok' | 'err';

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
};

type GithubEntry = { label: string; token: string; status: Status; error?: string; login?: string };

const STEPS = ['welcome', 'notion', 'github', 'claude', 'repos', 'review'] as const;
type Step = (typeof STEPS)[number];
const STEP_TITLE: Record<Step, string> = {
  welcome: '시작하기',
  notion: 'Notion 연결',
  github: 'GitHub 연결',
  claude: 'Claude',
  repos: '로컬 Git (선택)',
  review: '완료',
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
});

export function Onboarding({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
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
  }

  async function searchPages(i: number) {
    const e = notion[i]!;
    patchNotion(i, { searching: true });
    try {
      const pages = await window.cairn.onboarding.searchNotion(e.token.trim(), e.query);
      patchNotion(i, { pages });
    } finally {
      patchNotion(i, { searching: false });
    }
  }

  async function testGithub(i: number) {
    const e = github[i]!;
    if (!e.token.trim()) return;
    patchGithub(i, { status: 'testing', error: undefined });
    const r = await window.cairn.onboarding.probeGithub(e.token.trim());
    patchGithub(i, r.ok ? { status: 'ok', login: r.login } : { status: 'err', error: r.error });
  }

  const notionValid = notion.some((e) => e.status === 'ok' && e.pageId && e.personId);

  async function finish() {
    setFinishing(true);
    setFinishErr(null);
    const r = await window.cairn.onboarding.finish({
      notion: notion
        .filter((e) => e.status === 'ok' && e.pageId && e.personId)
        .map((e) => ({
          label: e.label,
          token: e.token.trim(),
          pageId: e.pageId,
          myUserId: e.personId,
        })),
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

  async function addRepo() {
    const p = await window.cairn.onboarding.pickFolder();
    if (p && !repos.includes(p)) setRepos((prev) => [...prev, p]);
  }

  const canNext = step === 'notion' ? notionValid : true;

  return (
    <div className="panel-enter flex h-screen w-screen flex-col bg-canvas text-ink">
      <div className="h-11 shrink-0 [-webkit-app-region:drag]" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden px-8">
        <div className="flex items-center gap-2.5 pb-5">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-white">
            <BrandMark size={17} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.3px]">cairn</span>
          <span className="ml-auto text-[12px] text-ink-tertiary">
            {stepIdx + 1} / {STEPS.length} · {STEP_TITLE[step]}
          </span>
        </div>

        <div key={step} className="panel-enter flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {step === 'welcome' && <Welcome />}
          {step === 'notion' && (
            <Section
              desc="일지를 발행할 Notion 워크스페이스. integration 토큰 + 발행할 부모 페이지를 연결합니다."
              link={{
                label: 'Notion integration 만들기',
                url: 'https://www.notion.so/my-integrations',
              }}
            >
              {notion.map((e, i) => (
                <NotionCard
                  key={i}
                  e={e}
                  onChange={(p) => patchNotion(i, p)}
                  onTest={() => void testNotion(i)}
                  onSearch={() => void searchPages(i)}
                  onRemove={
                    notion.length > 1
                      ? () => setNotion((p) => p.filter((_, x) => x !== i))
                      : undefined
                  }
                />
              ))}
              <AddButton
                label="워크스페이스 추가"
                onClick={() => setNotion((p) => [...p, newNotion(`Workspace ${p.length + 1}`)])}
              />
            </Section>
          )}
          {step === 'github' && (
            <Section
              desc="PR · 리뷰 · 커밋을 수집할 GitHub 계정 (선택). Fine-grained PAT 권장 — Repository access 에 대상 repo 포함 + 권한 Pull requests · Contents · Metadata = Read"
              link={{
                label: 'GitHub Fine-grained PAT 만들기',
                url: 'https://github.com/settings/personal-access-tokens/new',
              }}
            >
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
                label="계정 추가"
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
            <Section desc="cairn 은 활동을 한국어로 요약하는 데 Claude 를 씁니다.">
              <div className="rounded-lg border border-hairline bg-surface-1 p-4 text-[13px] leading-relaxed text-ink-muted">
                <p className="mb-2 font-medium text-ink">
                  Claude Code CLI 가 로그인돼 있으면 자동 — 추가 과금 0
                </p>
                <p className="text-ink-subtle">
                  로그인된 Claude(Pro/Max 등) 인증을 그대로 인계받습니다. 아래는 선택 사항이에요.
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] text-ink-muted">또는 Anthropic API key (선택)</p>
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
                  <ExternalLink size={11} strokeWidth={2} /> API key 발급
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
                  연결 확인
                </button>
                {claudeStatus === 'ok' && (
                  <span className="inline-flex items-center gap-1 text-[13px] text-success">
                    <Check size={14} strokeWidth={2.5} /> Claude 연결됨
                  </span>
                )}
                {claudeStatus === 'err' && (
                  <span className="text-[13px] text-[#f87171]">
                    연결 안 됨 — claude 로그인 또는 API key 필요
                  </span>
                )}
                {claudeStatus === 'testing' && (
                  <span className="text-[12px] text-ink-tertiary">확인 중... (최대 1분)</span>
                )}
              </div>
            </Section>
          )}
          {step === 'repos' && (
            <Section desc="커밋을 수집할 로컬 Git 저장소 경로. (선택)">
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
              <AddButton icon={FolderPlus} label="폴더 추가" onClick={() => void addRepo()} />
            </Section>
          )}
          {step === 'review' && (
            <Section desc="아래 내용으로 설정 파일을 작성합니다.">
              <ul className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
                <li>
                  Notion 워크스페이스 {notion.filter((e) => e.status === 'ok' && e.pageId).length}개
                </li>
                <li>GitHub 계정 {github.filter((e) => e.status === 'ok').length}개</li>
                <li>Claude {anthropicKey.trim() ? 'API key' : '자동(CLI 인계)'}</li>
                <li>로컬 Git {repos.length}개</li>
              </ul>
              {finishErr && <p className="text-[13px] text-[#f87171]">작성 실패: {finishErr}</p>}
            </Section>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-hairline py-4">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => setStepIdx((s) => s - 1)}
              className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              이전
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-2 text-[13px] text-ink-tertiary hover:text-ink-muted"
            >
              취소
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
                시작하기
              </button>
            ) : (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStepIdx((s) => s + 1)}
                className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                다음
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-[22px] font-semibold tracking-[-0.4px]">cairn 셋업</h1>
      <p className="text-[14px] leading-relaxed text-ink-muted">
        등산로의 돌탑처럼, 매일 작업 흔적을 모아 Notion 일지로 남깁니다. 시작하려면 세 가지만
        연결하면 돼요:
      </p>
      <ul className="flex flex-col gap-2 text-[13px] text-ink-subtle">
        <li>
          · <span className="text-ink-muted">Notion</span> — 일지를 발행할 곳
        </li>
        <li>
          · <span className="text-ink-muted">GitHub</span> — PR·리뷰·커밋 수집 (선택)
        </li>
        <li>
          · <span className="text-ink-muted">Claude</span> — 한국어 요약 (CLI 로그인 시 자동)
        </li>
      </ul>
    </div>
  );
}

function Section({
  desc,
  link,
  children,
}: {
  desc: string;
  link?: { label: string; url: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-[13px] leading-relaxed text-ink-muted">{desc}</p>
      {link && (
        <button
          type="button"
          onClick={() => void window.cairn.openExternal(link.url)}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
        >
          <ExternalLink size={11} strokeWidth={2} /> {link.label}
        </button>
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
  label,
  token,
  status,
  onChange,
  onTest,
  onRemove,
}: {
  label: string;
  token: string;
  status: Status;
  onChange: (p: { label?: string; token?: string }) => void;
  onTest: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="라벨"
        className="w-24 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 text-[13px] text-ink focus:border-accent/60 focus:outline-none"
      />
      <input
        type="password"
        value={token}
        onChange={(e) => onChange({ token: e.target.value })}
        placeholder="토큰"
        className="flex-1 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/60 focus:outline-none"
      />
      <button
        type="button"
        onClick={onTest}
        disabled={!token.trim() || status === 'testing'}
        className="shrink-0 rounded-md border border-hairline px-2.5 py-2 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
      >
        테스트
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
  );
}

function NotionCard({
  e,
  onChange,
  onTest,
  onSearch,
  onRemove,
}: {
  e: NotionEntry;
  onChange: (p: Partial<NotionEntry>) => void;
  onTest: () => void;
  onSearch: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface-1 p-3">
      <LabelToken
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
              <option value="">내 계정 선택</option>
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
              placeholder="발행할 페이지 이름 검색"
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
              검색
            </button>
          </div>
          {e.pages.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-hairline [scrollbar-gutter:stable]">
              {e.pages.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => onChange({ pageId: pg.id })}
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
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
      <LabelToken
        label={e.label}
        token={e.token}
        status={e.status}
        onChange={onChange}
        onTest={onTest}
        onRemove={onRemove}
      />
      {e.status === 'err' && <p className="text-[12px] text-[#f87171]">{e.error}</p>}
      {e.status === 'ok' && e.login && (
        <p className="text-[12px] text-ink-subtle">@{e.login} 연결됨</p>
      )}
    </div>
  );
}
