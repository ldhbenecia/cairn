import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { Language, Theme } from '../cairn-api';
import { useSettings } from '../settings-context';
import { Toggle } from './toggle';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerunSetup: () => void;
};

export function PreferencesDialog({ open, onOpenChange, onRerunSetup }: Props) {
  const { settings, update, t } = useSettings();

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
        <Dialog.Content className="dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-128 max-w-[90vw] flex-col rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <Dialog.Title className="text-[16px] font-semibold tracking-[-0.2px] text-ink">
              {t('prefs.title')}
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-7 overflow-y-auto px-6 py-6 [scrollbar-gutter:stable]">
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

            <Section title={t('prefs.connections')}>
              <Row label={t('prefs.connections.desc')}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onRerunSetup();
                  }}
                  className="rounded-md border border-hairline px-3 py-1.5 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  {t('prefs.rerunSetup')}
                </button>
              </Row>
            </Section>

            <Section title={t('prefs.about')}>
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[13px]">
                <span className="text-ink-muted">cairn</span>
                <span className="font-mono text-ink-subtle">v{window.cairn.version}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.privacy')}</p>
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
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
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
