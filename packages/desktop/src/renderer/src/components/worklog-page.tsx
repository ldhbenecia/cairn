import type { RunSession } from '../App';
import type { CoreMode, CoreRunOptions, RecentListResult } from '../cairn-api';
import { RecentTable } from './recent-panel';
import { RunPanel } from './run-panel';

const MODE_TABS: { mode: CoreMode; label: string }[] = [
  { mode: 'daily', label: '오늘' },
  { mode: 'weekly', label: '이번 주' },
  { mode: 'monthly', label: '이번 달' },
];

const RUN_CONFIG: Record<CoreMode, { label: string; description: string }> = {
  daily: {
    label: '오늘 일지 발행',
    description: '오늘 활동을 수집해 노션 일지로 발행합니다.',
  },
  weekly: {
    label: '이번 주 정리 발행',
    description: '지난 7일 활동을 모아 주간 롤업을 노션에 발행합니다.',
  },
  monthly: {
    label: '이번 달 정리 발행',
    description: '지난 한 달 활동을 모아 월간 롤업을 노션에 발행합니다.',
  },
};

type Props = {
  mode: CoreMode;
  onModeChange: (mode: CoreMode) => void;
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
  recent: RecentListResult | null;
  onReloadRecent: () => Promise<void>;
};

export function WorklogPage({
  mode,
  onModeChange,
  sessions,
  runningMode,
  onTrigger,
  recent,
  onReloadRecent,
}: Props) {
  const cfg = RUN_CONFIG[mode];
  return (
    <div className="flex flex-1 flex-col px-8 pb-8 [-webkit-app-region:no-drag]">
      <ModeTabs mode={mode} onChange={onModeChange} running={runningMode !== null} />
      <RunPanel
        key={mode}
        mode={mode}
        label={cfg.label}
        description={cfg.description}
        session={sessions[mode]}
        otherRunning={runningMode !== null && runningMode !== mode}
        onTrigger={(options) => onTrigger(mode, options)}
      />
      <RecentTable recent={recent} onReload={onReloadRecent} />
    </div>
  );
}

function ModeTabs({
  mode,
  onChange,
  running,
}: {
  mode: CoreMode;
  onChange: (mode: CoreMode) => void;
  running: boolean;
}) {
  return (
    <div className="mb-6 flex gap-1 border-b border-hairline">
      {MODE_TABS.map((t) => {
        const active = t.mode === mode;
        return (
          <button
            key={t.mode}
            type="button"
            disabled={running && !active}
            onClick={() => onChange(t.mode)}
            className={[
              'relative px-3 py-2 text-[14px] font-medium leading-[1.2] transition-colors',
              active ? 'text-ink' : 'text-ink-tertiary hover:text-ink-muted disabled:opacity-50',
            ].join(' ')}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
