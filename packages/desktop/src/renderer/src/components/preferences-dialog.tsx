import * as Dialog from '@radix-ui/react-dialog';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarClock,
  CreditCard,
  Info,
  Link2,
  MessageSquare,
  Monitor,
  SquarePen,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { AboutTab } from './preferences/about-tab';
import { AppearanceTab } from './preferences/appearance-tab';
import { AutoPublishTab } from './preferences/autopublish-tab';
import { BillingTab } from './preferences/billing-tab';
import { ConnectionsTab } from './preferences/connections-tab';
import { FeedbackTab } from './preferences/feedback-tab';
import { NotificationsTab } from './preferences/notifications-tab';
import { PromptsTab } from './preferences/prompts-tab';

type TabId =
  | 'appearance'
  | 'notifications'
  | 'autopublish'
  | 'prompts'
  | 'connections'
  | 'billing'
  | 'feedback'
  | 'about';

const TABS: { id: TabId; icon: LucideIcon; labelKey: I18nKey }[] = [
  { id: 'appearance', icon: Monitor, labelKey: 'prefs.appearance' },
  { id: 'notifications', icon: Bell, labelKey: 'prefs.notifications' },
  { id: 'autopublish', icon: CalendarClock, labelKey: 'prefs.autoPublish' },
  { id: 'prompts', icon: SquarePen, labelKey: 'prefs.prompts' },
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
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ width: 920, height: 600, maxWidth: '92vw', maxHeight: '86vh' }}
          className="dialog-content glass-panel fixed top-1/2 left-1/2 z-50 flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 focus:outline-none"
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
              <p className="mt-auto px-2.5 pt-2 text-[11px] text-ink-tertiary/60">
                cairn v{window.cairn.version}
              </p>
            </nav>

            <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6 [scrollbar-gutter:stable]">
              <div key={tab} className="panel-enter">
                {tab === 'appearance' && <AppearanceTab />}
                {tab === 'notifications' && <NotificationsTab />}
                {tab === 'autopublish' && <AutoPublishTab />}
                {tab === 'prompts' && <PromptsTab />}
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
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
