import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type {
  BusyState,
  CoreMode,
  CoreResult,
  CoreRunOptions,
  RecentListResult,
  RecentPage,
  RunLine,
  RunProgress,
  RunStep,
} from './cairn-api';
import { useSettings } from './settings-context';
import { Dashboard } from './components/dashboard';
import { Onboarding } from './components/onboarding';
import { PreferencesDialog } from './components/preferences-dialog';
import { AchievementsDialog } from './components/achievements-dialog';
import { CommandPalette } from './components/command-palette';
import { WorklogDrawer } from './components/worklog-drawer';
import {
  Sidebar,
  type FilterCounts,
  type MainView,
  type WorklogFilter,
} from './components/sidebar';
import { WorklogList } from './components/worklog-list';

export type RunSession = {
  state: 'running' | 'done';
  step: RunStep;
  lines: RunLine[];
  result?: CoreResult;
  error?: string;
  startedAt: number;
  endedAt?: number;
  batch?: boolean;
  progress?: RunProgress;
};

const TAIL_MAX = 200;

const EMPTY_SESSIONS: Record<CoreMode, RunSession | null> = {
  daily: null,
  weekly: null,
  monthly: null,
};

const RECENT_CACHE_KEY = 'cairn:recentCache:v1';

function readRecentCache(): RecentListResult | null {
  try {
    const raw = localStorage.getItem(RECENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentListResult;
    return Array.isArray(parsed?.pages) ? parsed : null;
  } catch {
    return null;
  }
}

export function App() {
  const [filter, setFilter] = useState<WorklogFilter>('all');
  const [view, setView] = useState<MainView>('stats');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [achvOpen, setAchvOpen] = useState(false);
  const [setupComplete, setSetupComplete] = useState(window.cairn.initialSetupComplete);
  const [everSetup, setEverSetup] = useState(window.cairn.initialSetupComplete);
  const [selectedPage, setSelectedPage] = useState<RecentPage | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('cairn:sidebarWidth'));
    return saved >= 200 && saved <= 420 ? saved : 248;
  });
  const [sessions, setSessions] = useState<Record<CoreMode, RunSession | null>>(EMPTY_SESSIONS);
  const [runningMode, setRunningMode] = useState<CoreMode | null>(null);
  const [busy, setBusy] = useState<BusyState>({ busy: false, mode: null });
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [recent, setRecent] = useState<RecentListResult | null>(readRecentCache);
  const { t } = useSettings();

  const loadRecent = useCallback(async () => {
    const r = await window.cairn.listRecent();
    setRecent(r);
    try {
      localStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(r));
    } catch {
      /* empty */
    }
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
    const trySync = (signedIn: boolean): void => {
      if (signedIn) void window.cairn.cloud.syncNow().catch(() => {});
    };
    void window.cairn.cloud
      .state()
      .then((s) => trySync(s.signedIn))
      .catch(() => {});
    const offChanged = window.cairn.cloud.onChanged((s) => trySync(s.signedIn));
    const offSynced = window.cairn.cloud.onStatsSynced(() => void loadRecent());
    return () => {
      offChanged();
      offSynced();
    };
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
    const off = window.cairn.onRunProgress(({ mode, ...progress }) => {
      setSessions((prev) => {
        const current = prev[mode] ?? {
          state: 'running' as const,
          step: 'boot' as const,
          lines: [],
          startedAt: Date.now(),
        };
        return {
          ...prev,
          [mode]: { ...current, batch: true, progress },
        };
      });
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.cairn.onRunDone(({ mode, result }) => {
      setSessions((prev) => {
        const current = prev[mode] ?? {
          state: 'running' as const,
          step: 'done' as const,
          lines: [],
          startedAt: Date.now(),
        };
        return {
          ...prev,
          [mode]: { ...current, state: 'done', step: 'done', result, endedAt: Date.now() },
        };
      });
      setRunningMode((rm) => (rm === mode ? null : rm));
      void loadRecent();
      void window.cairn.cloud.syncNow().catch(() => {});
    });
    return off;
  }, [loadRecent]);

  useEffect(() => {
    void window.cairn.busyState().then(setBusy);
    const off = window.cairn.onBusy(setBusy);
    return off;
  }, []);

  useEffect(() => {
    void window.cairn.runSnapshot().then((s) => {
      if (s.busy && s.mode) {
        setRunningMode(s.mode);
        // 마운트 중 트리거/브로드캐스트가 이미 세션을 만들었으면 덮지 않는다(스냅샷이 라이브를 지우는 레이스 방지)
        setSessions((prev) =>
          prev[s.mode!]
            ? prev
            : {
                ...prev,
                [s.mode!]: {
                  state: 'running',
                  step: s.step,
                  lines: [],
                  startedAt: s.startedAt,
                  batch: s.progress !== null,
                  progress: s.progress ?? undefined,
                },
              },
        );
      } else if (s.lastResult) {
        const { mode, result, endedAt } = s.lastResult;
        setSessions((prev) =>
          prev[mode]
            ? prev
            : {
                ...prev,
                [mode]: {
                  state: 'done',
                  step: 'done',
                  lines: [],
                  startedAt: 0, // 복원 시 실제 시작 시각 미상 → elapsed 표시 숨김
                  result,
                  endedAt,
                },
              },
        );
      }
    });
  }, []);

  useEffect(() => {
    const off = window.cairn.onFocusMode((focused) => {
      setView('worklogs');
      setFilter(focused);
    });
    return off;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setPrefsOpen(true);
      } else if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trigger = useCallback(
    async (mode: CoreMode, options?: CoreRunOptions) => {
      const active = busyRef.current;
      if (active.busy) {
        setSessions((prev) => ({
          ...prev,
          [mode]: {
            state: 'done',
            step: 'boot',
            lines: [],
            startedAt: Date.now(),
            endedAt: Date.now(),
            error: t('publish.busyMsg'),
          },
        }));
        return;
      }
      setRunningMode(mode);
      const batch = (options?.backfillDays ?? 0) > 0;
      setSessions((prev) => ({
        ...prev,
        [mode]: { state: 'running', step: 'boot', lines: [], startedAt: Date.now(), batch },
      }));
      try {
        await window.cairn.run(mode, options);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const message = /(^|:\s?(Error:\s?)?)busy:/.test(raw) ? t('publish.busyMsg') : raw;
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
    [t],
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
          setEverSetup(true);
          setSetupComplete(true);
          void loadRecent();
        }}
        onCancel={everSetup ? () => setSetupComplete(true) : undefined}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-canvas text-ink">
      <Sidebar
        width={sidebarWidth}
        view={view}
        filter={filter}
        counts={counts}
        preferencesActive={prefsOpen}
        onFilterChange={(f) => {
          setPrefsOpen(false);
          setView('worklogs');
          setFilter(f);
        }}
        onOpenStats={() => {
          setPrefsOpen(false);
          setView('stats');
        }}
        onOpenPreferences={() => setPrefsOpen(true)}
      />
      <div
        onMouseDown={startResize}
        className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40 [-webkit-app-region:no-drag]"
      />
      {view === 'stats' ? (
        <Dashboard
          recent={recent}
          onPickDate={(date) => {
            const p = recent?.pages.find((x) => x.category === 'daily' && x.date === date);
            if (p) setSelectedPage(p);
          }}
          onGoToWorklogs={() => setView('worklogs')}
        />
      ) : (
        <WorklogList
          recent={recent}
          filter={filter}
          sessions={sessions}
          runningMode={runningMode}
          onTrigger={trigger}
          onReload={loadRecent}
          onOpen={setSelectedPage}
          onAchievements={() => setAchvOpen(true)}
          drawerOpen={selectedPage !== null}
        />
      )}
      {selectedPage && <WorklogDrawer page={selectedPage} onClose={() => setSelectedPage(null)} />}
      {cmdkOpen && (
        <CommandPalette
          recent={recent}
          onClose={() => setCmdkOpen(false)}
          onView={setView}
          onPreferences={() => setPrefsOpen(true)}
          onPublish={(mode) => void trigger(mode)}
          onOpenPage={setSelectedPage}
          onAchievements={() => setAchvOpen(true)}
        />
      )}
      {achvOpen && <AchievementsDialog recent={recent} onClose={() => setAchvOpen(false)} />}
      <PreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        onRerunSetup={() => setSetupComplete(false)}
      />
    </div>
  );
}
