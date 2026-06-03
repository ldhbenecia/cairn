import * as Dialog from '@radix-ui/react-dialog';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Check,
  CreditCard,
  Info,
  Link2,
  MessageSquare,
  Monitor,
  Send,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Language, Theme } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { ACCENTS, useSettings } from '../settings-context';
import { Toggle } from './toggle';

const FEEDBACK_EMAIL = 'jh07050@gmail.com';

type TabId = 'appearance' | 'notifications' | 'connections' | 'billing' | 'feedback' | 'about';

const TABS: { id: TabId; icon: LucideIcon; labelKey: I18nKey }[] = [
  { id: 'appearance', icon: Monitor, labelKey: 'prefs.appearance' },
  { id: 'notifications', icon: Bell, labelKey: 'prefs.notifications' },
  { id: 'connections', icon: Link2, labelKey: 'prefs.connections' },
  { id: 'billing', icon: CreditCard, labelKey: 'prefs.billing' },
  { id: 'feedback', icon: MessageSquare, labelKey: 'prefs.feedback' },
  { id: 'about', icon: Info, labelKey: 'prefs.about' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerunSetup: () => void;
};

export function PreferencesDialog({ open, onOpenChange, onRerunSetup }: Props) {
  const { t } = useSettings();
  const [tab, setTab] = useState<TabId>('appearance');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          style={{ width: 920, height: 600, maxWidth: '92vw', maxHeight: '86vh' }}
          className="dialog-content fixed top-1/2 left-1/2 z-50 flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <Dialog.Title className="text-[16px] font-semibold tracking-[-0.2px] text-ink">
              {t('prefs.title')}
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:outline-none">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1">
            <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-hairline p-2.5">
              {TABS.map(({ id, icon: Icon, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={[
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors',
                    tab === id
                      ? 'bg-surface-2 font-medium text-ink'
                      : 'text-ink-subtle hover:bg-surface-2/60 hover:text-ink-muted',
                  ].join(' ')}
                >
                  <Icon size={15} strokeWidth={2} />
                  {t(labelKey)}
                </button>
              ))}
            </nav>

            <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6 [scrollbar-gutter:stable]">
              {tab === 'appearance' && <AppearanceTab />}
              {tab === 'notifications' && <NotificationsTab />}
              {tab === 'connections' && (
                <ConnectionsTab
                  onRerun={() => {
                    onOpenChange(false);
                    onRerunSetup();
                  }}
                />
              )}
              {tab === 'billing' && <BillingTab />}
              {tab === 'feedback' && <FeedbackTab />}
              {tab === 'about' && <AboutTab />}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AppearanceTab() {
  const { settings, update, t } = useSettings();
  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'system', label: t('prefs.theme.system') },
    { value: 'light', label: t('prefs.theme.light') },
    { value: 'dark', label: t('prefs.theme.dark') },
  ];
  const langOptions: { value: Language; label: string }[] = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
  ];

  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.theme')} desc={t('prefs.theme.desc')}>
        <div className="flex gap-3">
          {themeOptions.map((o) => (
            <ThemeCard
              key={o.value}
              value={o.value}
              label={o.label}
              selected={settings.theme === o.value}
              onSelect={() => update({ theme: o.value })}
            />
          ))}
        </div>
      </Field>

      <Field label={t('prefs.accent')} desc={t('prefs.accent.desc')}>
        <div className="flex gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.id}
              onClick={() => update({ accent: a.id })}
              className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105"
              style={{ background: a.color }}
            >
              {settings.accent === a.id && (
                <Check size={14} strokeWidth={3} className="text-white" />
              )}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('prefs.language')} desc={t('prefs.language.desc')}>
        <Segmented
          options={langOptions}
          value={settings.language}
          onChange={(v) => update({ language: v })}
        />
      </Field>
    </div>
  );
}

function NotificationsTab() {
  const { settings, update, t } = useSettings();
  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.notifications')} desc={t('prefs.notifications.desc')}>
        <Toggle checked={settings.notifications} onChange={(v) => update({ notifications: v })} />
      </Field>
    </div>
  );
}

function ConnectionsTab({ onRerun }: { onRerun: () => void }) {
  const { t } = useSettings();
  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.connections')} desc={t('prefs.connections.desc')}>
        <button
          type="button"
          onClick={onRerun}
          className="rounded-md border border-hairline px-3 py-1.5 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          {t('prefs.rerunSetup')}
        </button>
      </Field>
    </div>
  );
}

function BillingTab() {
  const { t } = useSettings();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
      <CreditCard size={26} strokeWidth={1.5} className="text-ink-tertiary" />
      <p className="text-[14px] font-medium text-ink-muted">{t('prefs.billing.soon')}</p>
      <p className="max-w-xs text-[12px] leading-relaxed text-ink-tertiary">
        {t('prefs.billing.desc')}
      </p>
    </div>
  );
}

function FeedbackTab() {
  const { t } = useSettings();
  const [feedback, setFeedback] = useState('');

  function send() {
    const subject = `cairn 피드백 (v${window.cairn.version})`;
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(feedback)}`;
    void window.cairn.openExternal(url);
    setFeedback('');
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.feedback.desc')}</p>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={t('prefs.feedback.placeholder')}
        rows={6}
        className="w-full resize-none rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={send}
        disabled={!feedback.trim()}
        className="inline-flex items-center gap-1.5 self-start rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        <Send size={13} strokeWidth={2} />
        {t('prefs.feedback.send')}
      </button>
    </div>
  );
}

function AboutTab() {
  const { t } = useSettings();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[13px]">
        <span className="text-ink-muted">cairn</span>
        <span className="font-mono text-ink-subtle">v{window.cairn.version}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.privacy')}</p>
    </div>
  );
}

const MOCK_PALETTE: Record<'light' | 'dark', { bg: string; win: string; line: string }> = {
  light: { bg: '#e6e7ea', win: '#ffffff', line: '#cfd2d8' },
  dark: { bg: '#1b1b20', win: '#26262c', line: '#3a3a42' },
};

function Mock({ variant }: { variant: 'light' | 'dark' }) {
  const p = MOCK_PALETTE[variant];
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: p.bg }}>
      <div
        className="flex h-[74%] w-[78%] flex-col gap-0.75 rounded-[5px] p-1.5"
        style={{ background: p.win, boxShadow: '0 1px 2px rgba(0,0,0,0.22)' }}
      >
        <div className="flex gap-0.75">
          <span className="size-1 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="size-1 rounded-full" style={{ background: '#febc2e' }} />
          <span className="size-1 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <div className="mt-0.5 h-0.75 w-2/3 rounded-full bg-accent" />
        <div className="h-0.75 w-full rounded-full" style={{ background: p.line }} />
        <div className="h-0.75 w-4/5 rounded-full" style={{ background: p.line }} />
      </div>
    </div>
  );
}

// 자동(system) = 애플처럼 라이트/다크를 대각선으로 분할
function AutoMock() {
  return (
    <div className="relative h-full w-full">
      <Mock variant="light" />
      <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
        <Mock variant="dark" />
      </div>
    </div>
  );
}

function ThemeCard({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Theme;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="group flex flex-col items-center gap-2">
      <span
        className={[
          'relative block h-16 w-24 overflow-hidden rounded-lg border-2 transition-colors',
          selected ? 'border-accent' : 'border-hairline group-hover:border-hairline-strong',
        ].join(' ')}
      >
        {value === 'system' ? <AutoMock /> : <Mock variant={value} />}
        {selected && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-accent text-white shadow">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </span>
      <span
        className={['text-[12px]', selected ? 'font-semibold text-ink' : 'text-ink-subtle'].join(
          ' ',
        )}
      >
        {label}
      </span>
    </button>
  );
}

function Field({
  label,
  desc,
  children,
  stacked = false,
}: {
  label: string;
  desc?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={[
        'py-5 first:pt-0 last:pb-0',
        stacked ? 'flex flex-col gap-3' : 'flex items-start justify-between gap-6',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {desc && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-tertiary">{desc}</p>}
      </div>
      {stacked ? children : <div className="shrink-0">{children}</div>}
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
