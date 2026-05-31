import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { ConfigResult, Language, Theme } from '../cairn-api';
import { useSettings } from '../settings-context';
import { Toggle } from './toggle';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PreferencesDialog({ open, onOpenChange }: Props) {
  const { settings, update, t } = useSettings();
  const [result, setResult] = useState<ConfigResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await window.cairn.readConfig();
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'dark', label: t('prefs.theme.dark') },
    { value: 'light', label: t('prefs.theme.light') },
    { value: 'system', label: t('prefs.theme.system') },
  ];
  const langOptions: { value: Language; label: string }[] = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-160 max-w-[90vw] flex-col rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <Dialog.Title className="text-[16px] font-semibold tracking-[-0.2px] text-ink">
              {t('prefs.title')}
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
            <Section title={t('prefs.appearance')}>
              <Row label={t('prefs.theme')}>
                <Segmented
                  options={themeOptions}
                  value={settings.theme}
                  onChange={(v) => update({ theme: v })}
                />
              </Row>
              <Row label={t('prefs.language')}>
                <Segmented
                  options={langOptions}
                  value={settings.language}
                  onChange={(v) => update({ language: v })}
                />
              </Row>
            </Section>

            <Section title={t('prefs.notifications')}>
              <Toggle
                checked={settings.notifications}
                onChange={(v) => update({ notifications: v })}
                label={t('prefs.notifications.desc')}
              />
            </Section>

            <Section title={t('prefs.config')}>
              <div className="mb-2 flex items-center gap-3">
                {result && (
                  <span className="truncate font-mono text-[11px] text-ink-tertiary">
                    {result.path}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw size={12} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
                  {t('list.reload')}
                </button>
              </div>
              {result?.raw ? (
                <pre className="max-h-60 overflow-auto rounded-lg border border-hairline bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
                  {result.raw}
                </pre>
              ) : (
                result && (
                  <div className="rounded-lg border border-hairline bg-surface-2 p-5 text-[13px] text-ink-muted">
                    {t('prefs.config.missing')}
                    <pre className="mt-3 overflow-auto rounded-md bg-canvas p-3 font-mono text-[12px] text-ink-subtle">{`mkdir -p ~/.cairn\ncp worklog.config.json .env ~/.cairn/`}</pre>
                  </div>
                )
              )}
              <p className="mt-3 text-[12px] text-ink-tertiary">{t('prefs.config.note')}</p>
            </Section>

            <Section title={t('prefs.about')}>
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[13px]">
                <span className="text-ink-muted">cairn</span>
                <span className="font-mono text-ink-subtle">v{window.cairn.version}</span>
              </div>
            </Section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-accent text-white' : 'text-ink-subtle hover:text-ink-muted',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
