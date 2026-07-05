import { Check, ExternalLink, FolderSearch, Loader2, NotebookPen, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExportStatus, NotionWorkspacePayload } from '../../cairn-api';
import { useSettings } from '../../settings-context';
import { ICloudMark, NotionMark, ObsidianMark } from '../brand-icons';
import { NotionCard, type NotionEntry } from '../onboarding-cards';
import { Toggle } from '../toggle';
import { Field } from './field';

const pad2 = (n: number): string => String(n).padStart(2, '0');

function fmtLastSync(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return sameDay ? hm : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}`;
}

function ServiceCard({
  icon,
  tileClass = 'bg-surface-2',
  title,
  badge,
  desc,
  action,
  dim = false,
  children,
}: {
  icon: ReactNode;
  tileClass?: string;
  title: string;
  badge?: ReactNode;
  desc: string;
  action?: ReactNode;
  dim?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={[
        'rounded-lg border border-hairline bg-surface-1 p-4',
        dim ? 'select-none opacity-55' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tileClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
            {title}
            {badge}
          </p>
          <p className="mt-0.5 break-keep text-[12px] leading-relaxed text-ink-tertiary">{desc}</p>
        </div>
        {action && <span className="flex shrink-0 items-center gap-1.5">{action}</span>}
      </div>
      {children}
    </div>
  );
}

const emptyNotionEntry = (): NotionEntry => ({
  uid: 'prefs',
  label: 'Personal',
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

function NotionIntegrationCard() {
  const { t, settings } = useSettings();
  const [labels, setLabels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<NotionEntry>(emptyNotionEntry);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const entryRef = useRef(entry);
  entryRef.current = entry;

  const loadLabels = (): void => {
    void window.cairn
      .readConfig()
      .then((r) => {
        const cfg = r.parsed as { notionWorkspaces?: { label?: string }[] } | null;
        const workspaces = cfg && Array.isArray(cfg.notionWorkspaces) ? cfg.notionWorkspaces : [];
        setLabels(workspaces.map((w) => w?.label ?? '').filter((l) => l.length > 0));
      })
      .catch(() => setLabels([]));
  };

  useEffect(loadLabels, []);

  const patch = (p: Partial<NotionEntry>): void => setEntry((prev) => ({ ...prev, ...p }));

  // 재연결 시 기존 워크스페이스 라벨을 프리필 — 라벨이 달라지면 교체가 아닌 추가가 되므로
  const openForm = (): void => {
    setEntry({ ...emptyNotionEntry(), label: labels[0] ?? 'Personal' });
    setOpen(true);
  };

  async function search(): Promise<void> {
    const e = entryRef.current;
    patch({ searching: true });
    try {
      const pages = await window.cairn.onboarding.searchNotion(e.token.trim(), e.query);
      patch({ pages, searched: true });
    } catch {
      patch({ pages: [], searched: true });
    } finally {
      patch({ searching: false });
    }
  }

  async function test(): Promise<void> {
    const e = entryRef.current;
    if (!e.token.trim()) return;
    patch({ status: 'testing', error: undefined });
    const r = await window.cairn.onboarding.probeNotion(e.token.trim());
    if (!r.ok) {
      patch({ status: 'err', error: r.error });
      return;
    }
    patch({
      status: 'ok',
      persons: r.persons,
      personId: r.persons.length === 1 ? r.persons[0]!.id : '',
    });
    void search();
  }

  async function selectPage(pageId: string): Promise<void> {
    patch({ pageId, worklogDbId: '', rollupDbId: '' });
    try {
      patch({
        databases: await window.cairn.onboarding.listDatabases(
          entryRef.current.token.trim(),
          pageId,
        ),
      });
    } catch {
      patch({ databases: [] });
    }
  }

  const complete = entry.status === 'ok' && !!entry.pageId && !!entry.personId;

  async function save(): Promise<void> {
    const e = entryRef.current;
    setSaving(true);
    setSaveErr(null);
    const worklogDb = e.databases.find((d) => d.databaseId === e.worklogDbId);
    const rollupDb = e.databases.find((d) => d.databaseId === e.rollupDbId);
    const payload: NotionWorkspacePayload = {
      label: e.label.trim() || 'Personal',
      token: e.token.trim(),
      pageId: e.pageId,
      myUserId: e.personId,
      ...(worklogDb
        ? { worklogDb: { databaseId: worklogDb.databaseId, dataSourceId: worklogDb.dataSourceId } }
        : {}),
      ...(rollupDb
        ? { rollupDb: { databaseId: rollupDb.databaseId, dataSourceId: rollupDb.dataSourceId } }
        : {}),
    };
    const r = await window.cairn.integrations.addNotion(payload);
    setSaving(false);
    if (r.ok) {
      setOpen(false);
      setEntry(emptyNotionEntry());
      loadLabels();
    } else {
      setSaveErr(r.error ?? 'failed');
    }
  }

  const connected = labels.length > 0;

  return (
    <ServiceCard
      icon={<NotionMark size={20} />}
      tileClass="border border-black/10 bg-white text-black shadow-sm"
      title="Notion"
      badge={
        connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-medium text-success">
            <Check size={11} strokeWidth={2.5} />
            {t('integrations.notion.connected')}
          </span>
        ) : undefined
      }
      desc={connected ? labels.join(' · ') : t('integrations.notion.desc')}
      action={
        !open ? (
          connected ? (
            <button
              type="button"
              onClick={openForm}
              className="rounded-md border border-hairline px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {t('integrations.notion.reconnect')}
            </button>
          ) : (
            <button
              type="button"
              onClick={openForm}
              className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              {t('integrations.notion.connect')}
            </button>
          )
        ) : undefined
      }
    >
      {open && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-hairline pt-3">
          <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('onb.notion.desc')}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() =>
                void window.cairn.openExternal('https://www.notion.so/my-integrations')
              }
              className="inline-flex w-fit items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
            >
              <ExternalLink size={11} strokeWidth={2} /> {t('onb.notion.link')}
            </button>
            <button
              type="button"
              onClick={() =>
                void window.cairn.openExternal(
                  `https://cairnlog.cloud${settings.language === 'ko' ? '/ko' : ''}/setup/notion`,
                )
              }
              className="inline-flex w-fit items-center gap-1 text-[12px] text-accent hover:text-accent-hover"
            >
              <ExternalLink size={11} strokeWidth={2} /> {t('onb.notion.webGuide')}
            </button>
          </div>
          <NotionCard
            e={entry}
            onChange={patch}
            onTest={() => void test()}
            onSearch={() => void search()}
            onSelectPage={(pageId) => void selectPage(pageId)}
          />
          {saveErr && (
            <p className="text-[12px] text-danger">
              {t('integrations.notion.saveFail')}: {saveErr}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-tertiary transition-colors hover:text-ink-muted"
            >
              {t('onb.nav.cancel')}
            </button>
            <button
              type="button"
              disabled={!complete || saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
              {t('integrations.notion.save')}
            </button>
          </div>
        </div>
      )}
    </ServiceCard>
  );
}

function ObsidianIntegrationCard() {
  const { settings, update, t } = useSettings();
  const exp = settings.export;
  const setExp = (patch: Partial<typeof exp>): void => update({ export: { ...exp, ...patch } });
  const [status, setStatus] = useState<ExportStatus | null>(null);

  useEffect(() => {
    void window.cairn.exportStatus().then(setStatus);
  }, [exp.folder]);

  const pickFolder = async (): Promise<void> => {
    const f = await window.cairn.pickExportFolder();
    if (f) setExp({ folder: f, autoSync: true });
  };
  const clearFolder = (): void => setExp({ folder: null, autoSync: false });

  const isVault = !!exp.folder && (status?.isVault ?? false);

  return (
    <ServiceCard
      icon={<ObsidianMark size={22} />}
      title="Obsidian"
      badge={
        isVault ? (
          <span className="rounded-full bg-violet-500/12 px-2 py-0.5 text-[10.5px] font-medium text-violet-400">
            {t('integrations.vaultDetected')}
          </span>
        ) : undefined
      }
      desc={t('integrations.obsidian.desc')}
      action={
        exp.folder ? (
          <>
            <button
              type="button"
              onClick={() => void pickFolder()}
              className="rounded-md border border-hairline px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {t('integrations.change')}
            </button>
            <button
              type="button"
              onClick={clearFolder}
              title={t('prefs.export.clear')}
              className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void pickFolder()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent-hover"
          >
            {t('prefs.export.pick')}
          </button>
        )
      }
    >
      {exp.folder && (
        <>
          {status && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-hairline pt-3 text-[12px] text-ink-tertiary">
              <span className="max-w-56 truncate font-mono" title={exp.folder}>
                {exp.folder}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                {status.fileCount}
                {t('integrations.files')}
              </span>
              <span>·</span>
              <span>
                {status.lastSyncAt
                  ? `${t('integrations.lastSync')} ${fmtLastSync(status.lastSyncAt)}`
                  : t('integrations.neverSynced')}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {isVault && (
                  <button
                    type="button"
                    onClick={() =>
                      void window.cairn.openExternal(
                        `obsidian://open?path=${encodeURIComponent(exp.folder!)}`,
                      )
                    }
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-violet-400 transition-colors hover:bg-violet-500/10"
                  >
                    <ExternalLink size={12} strokeWidth={2} />
                    {t('integrations.openObsidian')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void window.cairn.revealExportFolder()}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <FolderSearch size={12} strokeWidth={2} />
                  {t('integrations.reveal')}
                </button>
              </span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3">
            <div className="min-w-0">
              <p className="text-[12.5px] text-ink-muted">{t('prefs.export.autoSync')}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-tertiary">
                {t('prefs.export.autoSyncDesc')}
              </p>
            </div>
            <Toggle checked={exp.autoSync} onChange={(v) => setExp({ autoSync: v })} />
          </div>
        </>
      )}
    </ServiceCard>
  );
}

function ComingSoonCard({
  icon,
  tileClass,
  title,
  desc,
}: {
  icon: ReactNode;
  tileClass?: string;
  title: string;
  desc: string;
}) {
  const { t } = useSettings();
  return (
    <ServiceCard
      icon={icon}
      tileClass={tileClass}
      title={title}
      badge={
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-tertiary">
          {t('integrations.comingSoon')}
        </span>
      }
      desc={desc}
      dim
    />
  );
}

export function IntegrationsTab() {
  const { t } = useSettings();
  return (
    <div>
      <Field label={t('prefs.integrations')} desc={t('prefs.integrations.desc')}>
        <span />
      </Field>
      <div className="flex flex-col gap-3">
        <NotionIntegrationCard />
        <ObsidianIntegrationCard />
        <ComingSoonCard
          icon={<ICloudMark size={20} />}
          tileClass="bg-[#3693F3]/10"
          title={t('integrations.icloud.title')}
          desc={t('integrations.icloud.desc')}
        />
        <ComingSoonCard
          icon={<NotebookPen size={19} strokeWidth={1.8} className="text-warning" />}
          tileClass="bg-warning/10"
          title={t('integrations.notes.title')}
          desc={t('integrations.notes.desc')}
        />
      </div>
    </div>
  );
}
