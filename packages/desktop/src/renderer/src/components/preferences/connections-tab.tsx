import { Loader2, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ConnectionAccounts } from '../../cairn-api';
import { useSettings } from '../../settings-context';
import { AccountStatusPill } from '../account-status-pill';
import { Field } from './field';

type ParsedConfig = {
  notionWorkspaces?: { label: string }[];
  githubAccounts?: { label: string }[];
  localGitRepos?: string[];
};

type Claude = 'checking' | 'ok' | 'err';

// 연결 탭을 열 때마다 코어를 fork(probeClaude, 최대 ~1분)하지 않도록 세션 단위 캐시
let claudeCache: Exclude<Claude, 'checking'> | null = null;
let claudeInflight: Promise<boolean> | null = null;

function probeClaudeCached(force = false): Promise<Exclude<Claude, 'checking'>> {
  if (force) claudeCache = null;
  if (claudeCache) return Promise.resolve(claudeCache);
  claudeInflight ??= window.cairn.onboarding
    .probeClaude()
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      claudeInflight = null;
    });
  return claudeInflight.then((ok) => {
    claudeCache = ok ? 'ok' : 'err';
    return claudeCache;
  });
}

export function ConnectionsTab({ onRerun }: { onRerun: () => void }) {
  const { t } = useSettings();
  const [cfg, setCfg] = useState<ParsedConfig>({});
  const [claude, setClaude] = useState<Claude>(claudeCache ?? 'checking');
  const [accounts, setAccounts] = useState<ConnectionAccounts | null>(null);

  useEffect(() => {
    let alive = true;
    void window.cairn
      .readConfig()
      .then((r) => {
        if (alive) setCfg((r.parsed as ParsedConfig | null) ?? {});
      })
      .catch(() => {
        if (alive) setCfg({});
      });
    void probeClaudeCached().then((c) => {
      if (alive) setClaude(c);
    });
    void window.cairn.connections
      .accounts()
      .then((a) => {
        if (alive) setAccounts(a);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const refreshClaude = (): void => {
    setClaude('checking');
    void probeClaudeCached(true).then(setClaude);
  };

  const notion = cfg.notionWorkspaces ?? [];
  const github = cfg.githubAccounts ?? [];
  const repos = cfg.localGitRepos ?? [];

  const notionVals = notion.map((w) => {
    const acc = accounts?.notion.find((n) => n.label === w.label);
    return acc?.workspace ? `${w.label} · ${acc.workspace}` : w.label;
  });
  const githubVals = github.map((g) => {
    const acc = accounts?.github.find((a) => a.label === g.label);
    return acc?.login ? `${g.label} · @${acc.login}` : g.label;
  });

  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.connections')} desc={t('prefs.conn.localDataNote')}>
        <AccountStatusPill />
      </Field>
      <div className="py-5">
        <div className="space-y-2 rounded-lg border border-hairline bg-surface-1 p-3">
          <Row label="Notion" values={notionVals} />
          <Row label="GitHub" values={githubVals} />
          <Row
            label="Claude"
            pending={claude === 'checking'}
            ok={claude === 'ok'}
            onRefresh={claude === 'checking' ? undefined : refreshClaude}
          />
          <Row label={t('prefs.conn.localGit')} ok={repos.length > 0} note={String(repos.length)} />
        </div>
        <button
          type="button"
          onClick={onRerun}
          className="mt-3 rounded-md border border-hairline px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {t('prefs.rerunSetup')}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  values,
  ok,
  pending,
  note,
  onRefresh,
}: {
  label: string;
  values?: string[];
  ok?: boolean;
  pending?: boolean;
  note?: string;
  onRefresh?: () => void;
}) {
  const { t } = useSettings();
  const connected = pending ? false : values ? values.length > 0 : !!ok;
  const right = pending
    ? t('prefs.conn.checking')
    : values && values.length
      ? values.join(', ')
      : note && connected
        ? note
        : connected
          ? t('prefs.conn.connected')
          : t('prefs.conn.missing');
  return (
    <div className="flex items-center gap-2 text-[13px]">
      {pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-tertiary" />
      ) : (
        <span
          className={`size-1.5 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ink-tertiary'}`}
        />
      )}
      <span className="text-ink-muted">{label}</span>
      <span className="ml-auto truncate pl-3 text-[12px] text-ink-tertiary">{right}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          aria-label={t('prefs.conn.recheck')}
          className="shrink-0 rounded p-0.5 text-ink-tertiary transition-colors hover:text-ink-muted"
        >
          <RotateCw size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
