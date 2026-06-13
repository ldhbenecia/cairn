import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type {
  CoreMode,
  CoreResult,
  CoreRunOptions,
  RecentListResult,
  RecentPage,
  RunLine,
  RunStep,
} from './cairn-api';
import { Onboarding } from './components/onboarding';
import { PreferencesDialog } from './components/preferences-dialog';
import { WorklogDrawer } from './components/worklog-drawer';
import { Sidebar, type FilterCounts, type WorklogFilter } from './components/sidebar';
import { WorklogList } from './components/worklog-list';

export type RunSession = {
  state: 'running' | 'done';
  step: RunStep;
  lines: RunLine[];
  result?: CoreResult;
  error?: string;
  startedAt: number;
  endedAt?: number;
};

const TAIL_MAX = 200;

const EMPTY_SESSIONS: Record<CoreMode, RunSession | null> = {
  daily: null,
  weekly: null,
  monthly: null,
};

export function App() {
  const [filter, setFilter] = useState<WorklogFilter>('all');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [setupComplete, setSetupComplete] = useState(window.cairn.initialSetupComplete);
  const [selectedPage, setSelectedPage] = useState<RecentPage | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('cairn:sidebarWidth'));
    return saved >= 200 && saved <= 420 ? saved : 248;
  });
  const [sessions, setSessions] = useState<Record<CoreMode, RunSession | null>>(EMPTY_SESSIONS);
  const [runningMode, setRunningMode] = useState<CoreMode | null>(null);
  const [recent, setRecent] = useState<RecentListResult | null>(null);

  const loadRecent = useCallback(async () => {
    const r = await window.cairn.listRecent();
    setRecent(r);
  }, []);

  useEffect(() => {
    localStorage.setItem('cairn:sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setSidebarWidth(Math.min(420, Math.max(200, ev.clientX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    const off = window.cairn.onRunLine((l) => {
      setSessions((prev) => {
        const current = prev[l.mode] ?? {
          state: 'running',
          step: 'boot',
          lines: [],
          startedAt: Date.now(),
        };
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
        const current = prev[mode] ?? {
          state: 'running',
          step: 'boot',
          lines: [],
          startedAt: Date.now(),
        };
        return { ...prev, [mode]: { ...current, step } };
      });
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.cairn.onFocusMode((focused) => {
      setFilter(focused);
    });
    return off;
  }, []);

  // Cmd+, — macOS 표준 Preferences 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setPrefsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trigger = useCallback(
    async (mode: CoreMode, options?: CoreRunOptions) => {
      setRunningMode(mode);
      setSessions((prev) => ({
        ...prev,
        [mode]: { state: 'running', step: 'boot', lines: [], startedAt: Date.now() },
      }));
      try {
        const result = await window.cairn.run(mode, options);
        setSessions((prev) => {
          const current = prev[mode] ?? { state: 'running', step: 'done', lines: [] };
          return {
            ...prev,
            [mode]: { ...current, state: 'done', step: 'done', result, endedAt: Date.now() },
          };
        });
        void loadRecent();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSessions((prev) => {
          const current = prev[mode] ?? {
            state: 'running',
            step: 'boot',
            lines: [],
            startedAt: Date.now(),
          };
          return {
            ...prev,
            [mode]: { ...current, state: 'done', error: message, endedAt: Date.now() },
          };
        });
      } finally {
        setRunningMode(null);
      }
    },
    [loadRecent],
  );

  const counts = useMemo<FilterCounts>(() => {
    const pages = recent?.pages ?? [];
    return {
      all: pages.length,
      daily: pages.filter((p) => p.category === 'daily').length,
      weekly: pages.filter((p) => p.category === 'weekly').length,
      monthly: pages.filter((p) => p.category === 'monthly').length,
    };
  }, [recent]);

  if (!setupComplete) {
    return (
      <Onboarding
        onDone={() => {
          setSetupComplete(true);
          void loadRecent();
        }}
        onCancel={window.cairn.initialSetupComplete ? () => setSetupComplete(true) : undefined}
      />
    );
  }

  return (
    <div className="glass-root flex h-screen w-screen bg-canvas text-ink">
      <Sidebar
        width={sidebarWidth}
        filter={filter}
        counts={counts}
        preferencesActive={prefsOpen}
        onFilterChange={(f) => {
          setPrefsOpen(false);
          setFilter(f);
        }}
        onOpenPreferences={() => setPrefsOpen(true)}
      />
      <div
        onMouseDown={startResize}
        className="glass-divider w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40 [-webkit-app-region:no-drag]"
      />
      <WorklogList
        recent={recent}
        filter={filter}
        sessions={sessions}
        runningMode={runningMode}
        onTrigger={trigger}
        onReload={loadRecent}
        onOpen={setSelectedPage}
      />
      {selectedPage && <WorklogDrawer page={selectedPage} onClose={() => setSelectedPage(null)} />}
      <PreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        onRerunSetup={() => setSetupComplete(false)}
      />
    </div>
  );
}
