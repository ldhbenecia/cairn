import { ExternalLink, FolderOpen, FolderSearch, Gem, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportStatus } from '../../cairn-api';
import { useSettings } from '../../settings-context';
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

export function IntegrationsTab() {
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
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.integrations')} desc={t('prefs.integrations.desc')}>
        <span />
      </Field>

      <div className="py-4">
        <div className="rounded-lg border border-hairline bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <span
              className={[
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                isVault ? 'bg-violet-500/12 text-violet-400' : 'bg-accent/10 text-accent-hover',
              ].join(' ')}
            >
              {isVault ? (
                <Gem size={17} strokeWidth={2} />
              ) : (
                <FolderOpen size={17} strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                {isVault ? 'Obsidian' : t('integrations.markdown.title')}
                {isVault && (
                  <span className="rounded-full bg-violet-500/12 px-2 py-0.5 text-[10.5px] font-medium text-violet-400">
                    {t('integrations.vaultDetected')}
                  </span>
                )}
              </p>
              <p className="truncate text-[12px] text-ink-tertiary" title={exp.folder ?? undefined}>
                {exp.folder ?? t('integrations.noFolder')}
              </p>
            </div>
            {exp.folder ? (
              <span className="flex shrink-0 items-center gap-1.5">
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
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void pickFolder()}
                className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {t('prefs.export.pick')}
              </button>
            )}
          </div>

          {exp.folder && status && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-hairline pt-3 text-[12px] text-ink-tertiary">
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
        </div>
      </div>

      <Field
        label={t('prefs.export.autoSync')}
        desc={t('prefs.export.autoSyncDesc')}
        dim={!exp.folder}
      >
        <Toggle
          checked={exp.autoSync && !!exp.folder}
          disabled={!exp.folder}
          onChange={(v) => setExp({ autoSync: v })}
        />
      </Field>

      <p className="pt-5 text-[12px] leading-relaxed text-ink-tertiary">{t('integrations.soon')}</p>
    </div>
  );
}
