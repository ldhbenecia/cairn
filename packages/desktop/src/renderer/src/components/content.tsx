import type { RunSession } from '../App';
import type { CoreMode, CoreRunOptions, RecentListResult } from '../cairn-api';
import { LogsPanel } from './logs-panel';
import { RecentPanel } from './recent-panel';
import { RunPanel } from './run-panel';
import { SettingsPanel } from './settings-panel';
import type { NavKey } from './sidebar';

type RunNav = Extract<NavKey, 'today' | 'week' | 'month'>;

const TITLE: Record<NavKey, string> = {
  today: '오늘 일지',
  week: '이번 주 정리',
  month: '이번 달 정리',
  recent: '최근 노션 페이지',
  logs: '로그',
  settings: '설정',
};

const RUN_CONFIG: Record<RunNav, { mode: CoreMode; label: string; description: string }> = {
  today: {
    mode: 'daily',
    label: '오늘 일지 발행',
    description: '오늘 활동을 수집해 노션 일지로 발행합니다.',
  },
  week: {
    mode: 'weekly',
    label: '이번 주 정리 발행',
    description: '지난 7일 활동을 모아 주간 롤업을 노션에 발행합니다.',
  },
  month: {
    mode: 'monthly',
    label: '이번 달 정리 발행',
    description: '지난 한 달 활동을 모아 월간 롤업을 노션에 발행합니다.',
  },
};

const RUN_KEYS: ReadonlySet<NavKey> = new Set(['today', 'week', 'month']);

type Props = {
  active: NavKey;
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
  recent: RecentListResult | null;
  onReloadRecent: () => Promise<void>;
};

export function Content({
  active,
  sessions,
  runningMode,
  onTrigger,
  recent,
  onReloadRecent,
}: Props) {
  const cfg = RUN_KEYS.has(active) ? RUN_CONFIG[active as RunNav] : null;
  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-14 [-webkit-app-region:drag]" />
      <header className="px-8 pt-2 pb-6">
        <h1 className="font-sans text-[22px] font-medium leading-tight tracking-[-0.4px] text-ink">
          {TITLE[active]}
        </h1>
      </header>
      <div key={active} className="panel-enter flex flex-1 flex-col overflow-y-auto">
        {cfg ? (
          <RunPanel
            {...cfg}
            session={sessions[cfg.mode]}
            otherRunning={runningMode !== null && runningMode !== cfg.mode}
            onTrigger={(options) => onTrigger(cfg.mode, options)}
            recent={recent}
          />
        ) : active === 'recent' ? (
          <RecentPanel recent={recent} onReload={onReloadRecent} />
        ) : active === 'logs' ? (
          <LogsPanel />
        ) : (
          <SettingsPanel />
        )}
      </div>
    </section>
  );
}
