import { useCallback, useEffect, useState } from 'react';
import type { CoreMode, CoreResult, CoreRunOptions, RunLine } from './cairn-api';
import { Content } from './components/content';
import { Sidebar, type NavKey } from './components/sidebar';

export type RunSession = {
  state: 'running' | 'done';
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

  useEffect(() => {
    const off = window.cairn.onRunLine((l) => {
      setSessions((prev) => {
        const current = prev[l.mode] ?? { state: 'running', lines: [] };
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
    const off = window.cairn.onFocusMode((mode) => {
      setActive(MODE_TO_NAV[mode]);
    });
    return off;
  }, []);

  const trigger = useCallback(async (mode: CoreMode, options?: CoreRunOptions) => {
    setRunningMode(mode);
    setSessions((prev) => ({
      ...prev,
      [mode]: { state: 'running', lines: [] },
    }));
    try {
      const result = await window.cairn.run(mode, options);
      setSessions((prev) => {
        const current = prev[mode] ?? { state: 'running', lines: [] };
        return { ...prev, [mode]: { ...current, state: 'done', result } };
      });
    } finally {
      setRunningMode(null);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen bg-canvas text-ink">
      <Sidebar active={active} runningMode={runningMode} onSelect={setActive} />
      <Content active={active} sessions={sessions} runningMode={runningMode} onTrigger={trigger} />
    </div>
  );
}
