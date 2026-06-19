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
};

const TAIL_MAX = 200;

const EMPTY_SESSIONS: Record<CoreMode, RunSession | null> = {
  daily: null,
  weekly: null,
  monthly: null,
};

export function App() {
  const [filter, setFilter] = useState<WorklogFilter>('all');
  const [view, setView] = useState<MainView>('stats');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [achvOpen, setAchvOpen] = useState(false);
  const [setupComplete, setSetupComplete] = useState(window.cairn.initialSetupComplete);
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
  const [recent, setRecent] = useState<RecentListResult | null>(null);
  const { t } = useSettings();

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

  // 실행 완료 — 자동 발행 등 렌더러가 직접 트리거 안 한 실행도 여기서 done 처리 + 목록 갱신.
  // (수동 발행은 trigger 의 IPC resolve 와 함께 이 신호도 받지만 멱등)
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
    });
    return off;
  }, [loadRecent]);

  // 실행 중 작업(자동 발행 백필 포함) 인지 → 발행 버튼 잠금·"발행 중" 표시.
  useEffect(() => {
    void window.cairn.busyState().then(setBusy);
    const off = window.cairn.onBusy(setBusy);
    return off;
  }, []);

  useEffect(() => {
    const off = window.cairn.onFocusMode((focused) => {
      setView('worklogs');
      setFilter(focused);
    });
    return off;
  }, []);

  // Cmd+, — Preferences / Cmd+K — 커맨드 팔레트
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
      // 이미 다른 작업(수동·자동 발행·트레이)이 도는 중이면 친화 안내 후 중단.
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
      setSessions((prev) => ({
        ...prev,
        [mode]: { state: 'running', step: 'boot', lines: [], startedAt: Date.now() },
      }));
      try {
        // 완료 처리(done·result·목록 갱신)는 onRunDone 브로드캐스트가 담당 — 수동·자동 통일.
        await window.cairn.run(mode, options);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        // 메인이 던진 'busy:<mode>' 코드 → i18n 친화 문구. 그 외엔 원문 노출.
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
          setSetupComplete(true);
          void loadRecent();
        }}
        onCancel={window.cairn.initialSetupComplete ? () => setSetupComplete(true) : undefined}
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
