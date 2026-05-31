import { LayoutList, Loader2, Settings2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

type NavKey = 'worklog' | 'preferences';

type NavItem = {
  key: NavKey;
  label: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { key: 'worklog', label: 'Worklog', icon: LayoutList },
  { key: 'preferences', label: 'Preferences', icon: Settings2 },
];

type Props = {
  active: NavKey;
  running: boolean;
  lastPublished: string | null;
  onSelect: (key: NavKey) => void;
};

export function Sidebar({ active, running, lastPublished, onSelect }: Props) {
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-hairline bg-surface-1">
      <div className="h-14 [-webkit-app-region:drag]" />
      <div className="flex flex-1 flex-col gap-0.5 px-3 pb-3">
        {NAV.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            active={item.key === active}
            running={item.key === 'worklog' && running}
            onClick={() => onSelect(item.key)}
          />
        ))}
      </div>
      <Footer lastPublished={lastPublished} />
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
        'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] font-medium leading-[1.2] tracking-normal transition-colors',
        '[-webkit-app-region:no-drag]',
        active ? 'bg-surface-2 text-ink' : hover ? 'bg-surface-3 text-ink' : 'text-ink-subtle',
      ].join(' ')}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-accent" />
      )}
      <Icon size={15} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {running && <Loader2 size={13} strokeWidth={2} className="animate-spin text-accent" />}
    </button>
  );
}

function Footer({ lastPublished }: { lastPublished: string | null }) {
  return (
    <div className="border-t border-hairline px-4 py-3 text-[11px] text-ink-tertiary [-webkit-app-region:no-drag]">
      <div className="flex items-center justify-between">
        <span>cairn</span>
        <span className="font-mono">v{window.cairn.version}</span>
      </div>
      {lastPublished && <div className="mt-1">마지막 발행 {lastPublished}</div>}
    </div>
  );
}

export type { NavKey };
