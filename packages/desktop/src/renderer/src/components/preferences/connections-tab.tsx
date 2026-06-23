import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettings } from '../../settings-context';
import { AccountStatusPill } from '../account-status-pill';
import { Field } from './field';

type ParsedConfig = {
  notionWorkspaces?: { label: string }[];
  githubAccounts?: { label: string }[];
  localGitRepos?: string[];
};

export function ConnectionsTab({ onRerun }: { onRerun: () => void }) {
  const { t } = useSettings();
  const [cfg, setCfg] = useState<ParsedConfig>({});
  const [claude, setClaude] = useState<'checking' | 'ok' | 'err'>('checking');

  useEffect(() => {
    void window.cairn.readConfig().then((r) => setCfg((r.parsed as ParsedConfig | null) ?? {}));
    void window.cairn.onboarding.probeClaude().then((r) => setClaude(r.ok ? 'ok' : 'err'));
  }, []);

  const notion = cfg.notionWorkspaces ?? [];
  const github = cfg.githubAccounts ?? [];
  const repos = cfg.localGitRepos ?? [];

  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.connections')} desc={t('prefs.conn.localDataNote')}>
        <AccountStatusPill />
      </Field>
      <div className="py-5">
        <div className="space-y-2 rounded-lg border border-hairline bg-surface-1 p-3">
          <Row label="Notion" values={notion.map((w) => w.label)} />
          <Row label="GitHub" values={github.map((g) => g.label)} />
          <Row label="Claude" pending={claude === 'checking'} ok={claude === 'ok'} />
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
}: {
  label: string;
  values?: string[];
  ok?: boolean;
  pending?: boolean;
  note?: string;
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
    </div>
  );
}
