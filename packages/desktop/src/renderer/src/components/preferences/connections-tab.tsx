import { FolderGit2, Github, Loader2, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ConnectionAccounts } from '../../cairn-api';
import { useSettings } from '../../settings-context';
import { AccountStatusPill } from '../account-status-pill';
import { ClaudeMark, NotionMark } from '../brand-icons';
import { AccordionItem } from '../accordion';
import { Field } from './field';

type ParsedConfig = {
  notionWorkspaces?: { label: string }[];
  githubAccounts?: { label: string }[];
  localGitRepos?: string[];
};

type Claude = 'checking' | 'ok' | 'err';
type Item = { primary: string; secondary?: string };

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

function basename(p: string): string {
  const parts = p.replace(/[/\\]+$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

export function ConnectionsTab({ onRerun }: { onRerun: () => void }) {
  const { t } = useSettings();
  const [cfg, setCfg] = useState<ParsedConfig>({});
  const [claude, setClaude] = useState<Claude>(claudeCache ?? 'checking');
  const [accounts, setAccounts] = useState<ConnectionAccounts | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

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

  const toggle = (key: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const notion = cfg.notionWorkspaces ?? [];
  const github = cfg.githubAccounts ?? [];
  const repos = cfg.localGitRepos ?? [];

  const notionItems: Item[] = notion.map((w) => {
    const acc = accounts?.notion?.find((n) => n.label === w.label);
    return { primary: w.label, secondary: acc?.workspace };
  });
  const githubItems: Item[] = github.map((g) => {
    const acc = accounts?.github?.find((a) => a.label === g.label);
    return { primary: g.label, secondary: acc?.login ? `@${acc.login}` : undefined };
  });
  const repoItems: Item[] = repos.map((p) => ({ primary: basename(p), secondary: p }));

  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.connections')} desc={t('prefs.conn.localDataNote')}>
        <AccountStatusPill />
      </Field>
      <div className="py-5">
        <div className="space-y-0.5 rounded-lg border border-hairline bg-surface-1 p-1.5">
          <Row
            icon={
              <span className="flex shrink-0 text-ink-muted">
                <NotionMark size={13} />
              </span>
            }
            label="Notion"
            items={notionItems}
            expanded={open.has('notion')}
            onToggle={() => toggle('notion')}
          />
          <Row
            icon={<Github size={13} className="shrink-0 text-ink-muted" />}
            label="GitHub"
            items={githubItems}
            expanded={open.has('github')}
            onToggle={() => toggle('github')}
          />
          <Row
            icon={<ClaudeMark size={13} />}
            label="Claude"
            pending={claude === 'checking'}
            ok={claude === 'ok'}
            onRefresh={claude === 'checking' ? undefined : refreshClaude}
          />
          <Row
            icon={<FolderGit2 size={13} className="shrink-0 text-ink-muted" />}
            label={t('prefs.conn.localGit')}
            items={repoItems}
            expanded={open.has('repos')}
            onToggle={() => toggle('repos')}
          />
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
  icon,
  label,
  items,
  ok,
  pending,
  onRefresh,
  expanded,
  onToggle,
}: {
  icon?: React.ReactNode;
  label: string;
  items?: Item[];
  ok?: boolean;
  pending?: boolean;
  onRefresh?: () => void;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useSettings();
  const connected = pending ? false : items ? items.length > 0 : !!ok;
  const canExpand = !!items && items.length > 0 && !!onToggle;
  const summary = pending
    ? t('prefs.conn.checking')
    : items
      ? connected
        ? String(items.length)
        : t('prefs.conn.missing')
      : connected
        ? t('prefs.conn.connected')
        : t('prefs.conn.missing');

  const header = (
    <>
      {pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-tertiary" />
      ) : (
        <span
          className={`size-1.5 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ink-tertiary'}`}
        />
      )}
      {icon}
      <span className="text-ink-muted">{label}</span>
      <span className="ml-auto truncate pl-3 text-[12px] text-ink-tertiary">{summary}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          aria-label={t('prefs.conn.recheck')}
          className="shrink-0 rounded p-0.5 text-ink-tertiary transition-colors hover:text-ink-muted"
        >
          <RotateCw size={12} strokeWidth={2} />
        </button>
      )}
    </>
  );

  return (
    <AccordionItem
      open={!!expanded && canExpand}
      onToggle={onToggle ?? (() => {})}
      header={header}
      disabled={!canExpand}
      aria-label={`${label}: ${summary}`}
    >
      <div className="space-y-1 py-1 pl-4.5 pr-2">
        {(items ?? []).map((it, i) => (
          <div key={`${it.primary}-${i}`} className="flex items-baseline gap-2 text-[12px]">
            <span className="text-ink-muted">{it.primary}</span>
            {it.secondary && (
              <span className="truncate text-ink-tertiary" title={it.secondary}>
                {it.secondary}
              </span>
            )}
          </div>
        ))}
      </div>
    </AccordionItem>
  );
}
