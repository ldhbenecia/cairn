import type { RunSession } from '../App';
import type { CoreMode, CoreRunOptions, RecentListResult } from '../cairn-api';
import { SettingsPanel } from './settings-panel';
import type { NavKey } from './sidebar';
import { WorklogPage } from './worklog-page';

const TITLE: Record<NavKey, string> = {
  worklog: 'Worklog',
  preferences: 'Preferences',
};

type Props = {
  active: NavKey;
  mode: CoreMode;
  onModeChange: (mode: CoreMode) => void;
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
  recent: RecentListResult | null;
  onReloadRecent: () => Promise<void>;
};

export function Content({
  active,
  mode,
  onModeChange,
  sessions,
  runningMode,
  onTrigger,
  recent,
  onReloadRecent,
}: Props) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-14 [-webkit-app-region:drag]" />
      <header className="px-8 pt-2 pb-6">
        <h1 className="font-sans text-[22px] font-medium leading-tight tracking-[-0.4px] text-ink">
          {TITLE[active]}
        </h1>
      </header>
      <div key={active} className="panel-enter flex flex-1 flex-col overflow-y-auto">
        {active === 'worklog' ? (
          <WorklogPage
            mode={mode}
            onModeChange={onModeChange}
            sessions={sessions}
            runningMode={runningMode}
            onTrigger={onTrigger}
            recent={recent}
            onReloadRecent={onReloadRecent}
          />
        ) : (
          <SettingsPanel />
        )}
      </div>
    </section>
  );
}
