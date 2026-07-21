import {
  Box,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  LayoutList,
  LogIn,
  Orbit,
  LogOut,
  Search,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { useCloudAuth } from '../use-cloud-auth';
import { AccountStatusPill } from './account-status-pill';
import { BrandMark } from './brand-mark';

export type WorklogFilter = 'all' | 'daily' | 'weekly' | 'monthly';
export type MainView = 'worklogs' | 'stats' | 'graph' | 'reports';

export type FilterCounts = Record<WorklogFilter, number>;

const FILTERS: { key: WorklogFilter; labelKey: I18nKey; icon: LucideIcon }[] = [
  { key: 'all', labelKey: 'nav.all', icon: LayoutList },
  { key: 'daily', labelKey: 'nav.daily', icon: CalendarDays },
  { key: 'weekly', labelKey: 'nav.weekly', icon: CalendarRange },
  { key: 'monthly', labelKey: 'nav.monthly', icon: CalendarClock },
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
  onOpenReports: () => void;
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
  onOpenReports,
  onOpenPreferences,
  onOpenPalette,
}: Props) {
  const { t } = useSettings();
  const worklogActive = !preferencesActive && view === 'worklogs';
  return (
    <nav style={{ width }} className="flex shrink-0 flex-col border-r border-hairline bg-surface-1">
      <div className="h-20 [-webkit-app-region:drag]" />
      <div className="flex items-center gap-1.5 px-3.5 [-webkit-app-region:drag]">
        <div className="min-w-0 flex-1">
          <AccountTop onOpenPreferences={onOpenPreferences} />
        </div>
        <button
          type="button"
          onClick={onOpenPalette}
          title={`${t('nav.palette')} ⌘K`}
          aria-label={`${t('nav.palette')} ⌘K`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
        >
          <Search size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="mx-5 my-3 h-px bg-hairline" />

      <div className="flex flex-1 flex-col gap-0.5 px-3.5">
        <FilterItem
          icon={ChartColumn}
          label={t('nav.stats')}
          active={!preferencesActive && view === 'stats'}
          onClick={onOpenStats}
        />
        <FilterItem
          icon={Orbit}
          label={t('nav.graph')}
          active={!preferencesActive && view === 'graph'}
          onClick={onOpenGraph}
        />
        <FilterItem
          icon={Box}
          label={t('nav.reports')}
          active={!preferencesActive && view === 'reports'}
          onClick={onOpenReports}
        />

        <div className="px-2 pb-2.5 pt-7 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
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

      <div className="px-3.5 pb-4">
        <ClaudeStatusRow />
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

const CLAUDE_PROBE_INTERVAL_MS = 5 * 60_000;

// Claude CLI 도달 여부 소형 상태 행 — 시작 시 1회 + 5분 간격, 클릭 시 즉시 재확인
function ClaudeStatusRow() {
  const { t } = useSettings();
  const [status, setStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  const probing = useRef(false);

  const probe = useCallback(async (): Promise<void> => {
    if (probing.current) return;
    probing.current = true;
    setStatus('checking');
    try {
      const r = await window.cairn.onboarding.probeClaude();
      setStatus(r.ok ? 'ok' : 'fail');
    } catch {
      setStatus('fail');
    } finally {
      probing.current = false;
    }
  }, []);

  useEffect(() => {
    void probe();
    const id = setInterval(() => void probe(), CLAUDE_PROBE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [probe]);

  const dot = {
    checking: 'animate-pulse bg-ink-tertiary',
    ok: 'bg-success',
    fail: 'bg-danger',
  }[status];
  const label = {
    checking: t('claude.status.checking'),
    ok: t('claude.status.ok'),
    fail: t('claude.status.fail'),
  }[status];

  return (
    <button
      type="button"
      onClick={() => void probe()}
      title={status === 'fail' ? t('claude.status.failHint') : label}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[11.5px] text-ink-tertiary transition-colors hover:bg-surface-2/60 hover:text-ink-muted [-webkit-app-region:no-drag]"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </button>
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
      </button>
      {open && (
        <div
          className={`floating-panel ${closing ? 'popover-out' : 'popover-in'} absolute left-0 top-full z-20 mt-1 w-60 max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-hairline bg-surface-1 p-1 shadow-xl shadow-black/40 [transform-origin:top]`}
        >
          <div className="px-2.5 py-2">
            <div className="flex items-center gap-2">
              <Avatar user={user} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                {user.name}
              </span>
              <AccountStatusPill />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug break-all text-ink-tertiary">
              {user.email}
            </p>
          </div>
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
        'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium leading-[1.3] transition-colors [-webkit-app-region:no-drag]',
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
