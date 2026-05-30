import { useCallback, useEffect, useState } from 'react';
import type {
  CoreMode,
  CoreResult,
  CoreRunOptions,
  RecentListResult,
  RunLine,
  RunStep,
} from './cairn-api';
import { Content } from './components/content';
import { Sidebar, type NavKey } from './components/sidebar';

export type RunSession = {
  state: 'running' | 'done';
  step: RunStep;
  lines: RunLine[];
  result?: CoreResult;
};

const TAIL_MAX = 200;

const EMPTY_SESSIONS: Record<CoreMode, RunSession | null> = {
  daily: null,
  weekly: null,
  monthly: null,
};

const MODE_TO_NAV: Record<CoreMode, NavKey> = {
  daily: 'today',
  weekly: 'week',
  monthly: 'month',
};

export function App() {
  const [active, setActive] = useState<NavKey>('today');
  const [sessions, setSessions] = useState<Record<CoreMode, RunSession | null>>(EMPTY_SESSIONS);
  const [runningMode, setRunningMode] = useState<CoreMode | null>(null);
  const [recent, setRecent] = useState<RecentListResult | null>(null);

  const loadRecent = useCallback(async () => {
    const r = await window.cairn.listRecent();
    setRecent(r);
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    const off = window.cairn.onRunLine((l) => {
      setSessions((prev) => {
        const current = prev[l.mode] ?? { state: 'running', step: 'boot', lines: [] };
        const next: RunSession = {
          ...current,
          lines:
            current.lines.length >= TAIL_MAX
              ? [...current.lines.slice(1), l]
              : [...current.lines, l],
        };
        return { ...prev, [l.mode]: next };
      });
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.cairn.onRunStep(({ mode, step }) => {
      setSessions((prev) => {
        const current = prev[mode] ?? { state: 'running', step: 'boot', lines: [] };
        return { ...prev, [mode]: { ...current, step } };
      });
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.cairn.onFocusMode((mode) => {
      setActive(MODE_TO_NAV[mode]);
    });
    return off;
  }, []);

  const trigger = useCallback(
    async (mode: CoreMode, options?: CoreRunOptions) => {
      setRunningMode(mode);
      setSessions((prev) => ({
        ...prev,
        [mode]: { state: 'running', step: 'boot', lines: [] },
      }));
      try {
        const result = await window.cairn.run(mode, options);
        setSessions((prev) => {
          const current = prev[mode] ?? { state: 'running', step: 'done', lines: [] };
          return { ...prev, [mode]: { ...current, state: 'done', step: 'done', result } };
        });
        void loadRecent();
      } finally {
        setRunningMode(null);
      }
    },
    [loadRecent],
  );

  return (
    <div className="flex h-screen w-screen bg-canvas text-ink">
      <Sidebar active={active} runningMode={runningMode} onSelect={setActive} />
      <Content
        active={active}
        sessions={sessions}
        runningMode={runningMode}
        onTrigger={trigger}
        recent={recent}
        onReloadRecent={loadRecent}
      />
    </div>
  );
}
