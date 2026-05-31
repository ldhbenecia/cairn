import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  LayoutList,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { BrandMark } from './brand-mark';

export type WorklogFilter = 'all' | 'daily' | 'weekly' | 'monthly';

export type FilterCounts = Record<WorklogFilter, number>;

const FILTERS: { key: WorklogFilter; labelKey: I18nKey; icon: LucideIcon }[] = [
  { key: 'all', labelKey: 'nav.all', icon: LayoutList },
  { key: 'daily', labelKey: 'nav.daily', icon: CalendarDays },
  { key: 'weekly', labelKey: 'nav.weekly', icon: CalendarRange },
  { key: 'monthly', labelKey: 'nav.monthly', icon: CalendarClock },
];

type Props = {
  width: number;
  filter: WorklogFilter;
  counts: FilterCounts;
  preferencesActive: boolean;
  onFilterChange: (f: WorklogFilter) => void;
  onOpenPreferences: () => void;
};

export function Sidebar({
  width,
  filter,
  counts,
  preferencesActive,
  onFilterChange,
  onOpenPreferences,
}: Props) {
  const { t } = useSettings();
  return (
    <nav style={{ width }} className="flex shrink-0 flex-col border-r border-hairline bg-surface-1">
      <div className="h-20 [-webkit-app-region:drag]" />
      <div className="flex items-center gap-2.5 px-5 pb-6 [-webkit-app-region:drag]">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent text-white">
          <BrandMark size={15} />
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.2px] text-ink">cairn</span>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-4">
        <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
          {t('brand.worklog')}
        </div>
        {FILTERS.map((f) => (
          <FilterItem
            key={f.key}
            icon={f.icon}
            label={t(f.labelKey)}
            count={counts[f.key]}
            active={!preferencesActive && filter === f.key}
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
