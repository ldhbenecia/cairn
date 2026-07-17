import * as Dialog from '@radix-ui/react-dialog';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Blocks,
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
import { IntegrationsTab } from './preferences/integrations-tab';
import { NotificationsTab } from './preferences/notifications-tab';
import { PromptsTab } from './preferences/prompts-tab';

type TabId =
  | 'appearance'
  | 'notifications'
  | 'autopublish'
  | 'prompts'
  | 'connections'
  | 'integrations'
  | 'billing'
  | 'feedback'
  | 'about';

// 사용 빈도순 — 발행 스케줄·연동이 일상 조작, 소스 연결·결제는 설정 후 거의 안 봄
const TABS: { id: TabId; icon: LucideIcon; labelKey: I18nKey }[] = [
  { id: 'appearance', icon: Monitor, labelKey: 'prefs.appearance' },
  { id: 'autopublish', icon: CalendarClock, labelKey: 'prefs.autoPublish' },
  { id: 'integrations', icon: Blocks, labelKey: 'prefs.integrations' },
  { id: 'prompts', icon: SquarePen, labelKey: 'prefs.prompts' },
  { id: 'notifications', icon: Bell, labelKey: 'prefs.notifications' },
  { id: 'connections', icon: Link2, labelKey: 'prefs.connections' },
  { id: 'billing', icon: CreditCard, labelKey: 'prefs.billing' },
  { id: 'feedback', icon: MessageSquare, labelKey: 'prefs.feedback' },
  { id: 'about', icon: Info, labelKey: 'prefs.about' },
];

const TAB_DESC: Partial<Record<TabId, I18nKey>> = {
  appearance: 'prefs.appearance.desc',
  autopublish: 'prefs.autoPublish.desc',
  integrations: 'prefs.integrations.desc',
  prompts: 'prefs.prompts.tabDesc',
  connections: 'prefs.conn.localDataNote',
  billing: 'billing.lead',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerunSetup: () => void;
  blockEscape?: boolean;
};

export function PreferencesDialog({ open, onOpenChange, onRerunSetup, blockEscape }: Props) {
  const { t } = useSettings();
  const [tab, setTab] = useState<TabId>('appearance');
  const active = TABS.find((x) => x.id === tab) ?? TABS[0]!;
  const descKey = TAB_DESC[tab];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            // cmd+K 팔레트가 위에 떠 있으면 ESC 는 팔레트만 닫는다
            if (blockEscape) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            // 팔레트 오버레이가 전체를 덮어 모든 클릭이 outside 로 판정됨 — 팔레트만 닫는다
            if (blockEscape) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (blockEscape) e.preventDefault();
          }}
          style={{ width: 920, height: 600, maxWidth: '92vw', maxHeight: '86vh' }}
          className="dialog-content glass-panel fixed top-1/2 left-1/2 z-50 flex overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 focus:outline-none"
        >
          <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-hairline p-3">
            <Dialog.Title asChild>
              <p className="px-2.5 pt-1.5 pb-2.5 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
                {t('prefs.title')}
              </p>
            </Dialog.Title>
            {TABS.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={[
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
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

          <div className="relative min-w-0 flex-1">
            <Dialog.Close
              aria-label={t('publish.close')}
              className="absolute top-4 right-4 z-10 flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:outline-none"
            >
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
            <div className="h-full overflow-y-auto px-8 py-7 [scrollbar-gutter:stable]">
              <div key={tab} className="panel-enter">
                <header className="pb-5">
                  <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-ink">
                    {t(active.labelKey)}
                  </h2>
                  {descKey && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-tertiary">
                      {t(descKey)}
                    </p>
                  )}
                </header>
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
                {tab === 'integrations' && <IntegrationsTab />}
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
