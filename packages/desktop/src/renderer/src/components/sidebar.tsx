import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  LayoutList,
  Command,
  LogIn,
  Orbit,
  LogOut,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { useCloudAuth } from '../use-cloud-auth';
import { AccountStatusPill } from './account-status-pill';
import { BrandMark } from './brand-mark';

export type WorklogFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MainView = 'worklogs' | 'stats' | 'graph';

export type FilterCounts = Record<WorklogFilter, number>;

const FILTERS: { key: WorklogFilter; labelKey: I18nKey; icon: LucideIcon }[] = [
  { key: 'all', labelKey: 'nav.all', icon: LayoutList },
  { key: 'daily', labelKey: 'nav.daily', icon: CalendarDays },
  { key: 'weekly', labelKey: 'nav.weekly', icon: CalendarRange },
  { key: 'monthly', labelKey: 'nav.monthly', icon: CalendarClock },
  { key: 'yearly', labelKey: 'nav.yearly', icon: CalendarCheck },
];

type Props = {
  width: number;
  view: MainView;
  filter: WorklogFilter;
  counts: FilterCounts;
  preferencesActive: boolean;
  onFilterChange: (f: WorklogFilter) => void;
  onOpenStats: () => void;
  onOpenGraph: () => void;
  onOpenPreferences: () => void;
  onOpenPalette: () => void;
};

export function Sidebar({
  width,
  view,
  filter,
  counts,
  preferencesActive,
  onFilterChange,
  onOpenStats,
  onOpenGraph,
  onOpenPreferences,
  onOpenPalette,
}: Props) {
  const { t, settings } = useSettings();
  const worklogActive = !preferencesActive && view === 'worklogs';
  return (
    <nav style={{ width }} className="flex shrink-0 flex-col border-r border-hairline bg-surface-1">
      <div className="h-20 [-webkit-app-region:drag]" />
      <div className="px-4 pb-5 [-webkit-app-region:drag]">
        <AccountTop onOpenPreferences={onOpenPreferences} />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-4">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[13px] font-medium leading-[1.3] text-ink-subtle transition-colors hover:bg-surface-2/60 hover:text-ink-muted [-webkit-app-region:no-drag]"
        >
          <Command size={15} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">{t('nav.palette')}</span>
          <kbd className="shrink-0 rounded border border-hairline-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">
            ⌘K
          </kbd>
        </button>
        <div className="mx-2 mb-1.5 mt-2 h-px bg-hairline" />
        <FilterItem
          icon={ChartColumn}
          label={t('nav.stats')}
          active={!preferencesActive && view === 'stats'}
          onClick={onOpenStats}
        />
        {settings.graph.enabled && (
          <FilterItem
            icon={Orbit}
            label={t('nav.graph')}
            active={!preferencesActive && view === 'graph'}
            onClick={onOpenGraph}
          />
        )}

        <div className="px-2 pb-2 pt-6 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
          {t('brand.worklog')}
        </div>
        {FILTERS.map((f) => (
          <FilterItem
            key={f.key}
            icon={f.icon}
            label={t(f.labelKey)}
            count={counts[f.key]}
            active={worklogActive && filter === f.key}
            onClick={() => onFilterChange(f.key)}
          />
        ))}
      </div>

      <div className="px-4 pb-4">
        <FilterItem
          icon={Settings2}
          label={t('nav.preferences')}
          active={preferencesActive}
          onClick={onOpenPreferences}
        />
      </div>
    </nav>
  );
}

function AccountTop({ onOpenPreferences }: { onOpenPreferences: () => void }) {
  const { t } = useSettings();
  const { signedIn, user } = useCloudAuth();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeMenu = (): void => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 130);
  };

  useEffect(() => {
    if (!open || closing) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, closing]);

  if (!signedIn || !user) {
    return (
      <div className="flex min-w-0 items-center gap-2.5 px-1 [-webkit-app-region:no-drag]">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-white">
          <BrandMark size={15} />
        </span>
        <span className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.2px] text-ink">
          cairn
        </span>
        <AccountStatusPill />
        <button
          type="button"
          onClick={() => void window.cairn.cloud.signIn().catch(() => {})}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogIn size={13} strokeWidth={2} />
          {t('account.signIn')}
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative [-webkit-app-region:no-drag]">
      <button
        type="button"
        onClick={() => (open ? closeMenu() : setOpen(true))}
        className={[
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
          open ? 'bg-surface-2' : 'hover:bg-surface-2/70',
        ].join(' ')}
      >
        <Avatar user={user} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
          {user.name}
        </span>
        <AccountStatusPill className="mr-0.5" />
      </button>
      {open && (
        <div
          className={`floating-panel ${closing ? 'popover-out' : 'popover-in'} absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-hairline bg-surface-1 p-1 shadow-xl shadow-black/40 [transform-origin:top]`}
        >
          <p className="truncate px-2.5 py-1.5 text-[12px] leading-tight text-ink-tertiary">
            {user.email}
          </p>
          <div className="my-1 h-px bg-hairline" />
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onOpenPreferences();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Settings2 size={14} strokeWidth={1.75} />
            {t('nav.preferences')}
          </button>
          <button
            type="button"
            onClick={() => {
              closeMenu();
              void window.cairn.cloud.signOut().catch(() => {});
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <LogOut size={14} strokeWidth={1.75} />
            {t('account.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }: { user: { name: string; image: string | null } }) {
  const [broken, setBroken] = useState(false);
  if (user.image && !broken) {
    return (
      <img
        src={user.image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
      {user.name.charAt(0).toUpperCase()}
    </span>
  );
}

function FilterItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={[
        'relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[13px] font-medium leading-[1.3] transition-colors [-webkit-app-region:no-drag]',
        active
          ? 'bg-surface-2 text-ink'
          : hover
            ? 'bg-surface-2/60 text-ink-muted'
            : 'text-ink-subtle',
      ].join(' ')}
    >
      {active && (
        <span className="absolute -left-3 top-1/2 h-3.5 w-0.75 -translate-y-1/2 rounded-r-full bg-accent" />
      )}
      <Icon size={15} strokeWidth={1.75} className={active ? 'text-ink-muted' : ''} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-[11px] text-ink-tertiary">{count}</span>
      )}
    </button>
  );
}
