import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  FileText,
  Loader2,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { CoreMode } from '../cairn-api';

type NavKey = 'today' | 'week' | 'month' | 'recent' | 'logs' | 'settings';

type NavItem = {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  mode?: CoreMode;
};

const NAV: NavItem[] = [
  { key: 'today', label: '오늘 일지', icon: CalendarDays, mode: 'daily' },
  { key: 'week', label: '이번 주 정리', icon: CalendarRange, mode: 'weekly' },
  { key: 'month', label: '이번 달 정리', icon: CalendarClock, mode: 'monthly' },
  { key: 'recent', label: '최근 노션 페이지', icon: FileText },
  { key: 'logs', label: '로그', icon: ScrollText },
  { key: 'settings', label: '설정', icon: Settings },
];

type Props = {
  active: NavKey;
  runningMode: CoreMode | null;
  onSelect: (key: NavKey) => void;
};

export function Sidebar({ active, runningMode, onSelect }: Props) {
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-hairline bg-surface-1">
      <div className="h-14 [-webkit-app-region:drag]" />
      <div className="flex flex-col gap-0.5 px-3 pb-3">
        {NAV.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            active={item.key === active}
            running={item.mode !== undefined && item.mode === runningMode}
            onClick={() => onSelect(item.key)}
          />
        ))}
      </div>
    </nav>
  );
}

function SidebarItem({
  item,
  active,
  running,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  running: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={[
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] font-medium leading-[1.2] tracking-normal transition-colors',
        '[-webkit-app-region:no-drag]',
        active ? 'bg-surface-2 text-ink' : hover ? 'bg-surface-3 text-ink' : 'text-ink-subtle',
      ].join(' ')}
    >
      <Icon size={15} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {running && <Loader2 size={13} strokeWidth={2} className="animate-spin text-accent" />}
    </button>
  );
}

export type { NavKey };
