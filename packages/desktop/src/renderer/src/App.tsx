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
  RunProgress,
  RunStep,
} from './cairn-api';
import { AnimatePresence } from 'framer-motion';
import { resetRunLines } from './lib/run-line-store';
import { RunToast, type RunToastData } from './components/run-toast';
import { useSettings } from './settings-context';
import { Dashboard } from './components/dashboard';
import { GraphView } from './components/graph-view';
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
  result?: CoreResult;
  error?: string;
  startedAt: number;
  endedAt?: number;
  batch?: boolean;
  progress?: RunProgress;
};

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
  // 팔레트 발행 → worklogs 뷰의 PublishDialog 를 진행 화면으로 여는 신호
  const [publishProgressSignal, setPublishProgressSignal] = useState(0);
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
  const signedInRef = useRef(false);
  const [recent, setRecent] = useState<RecentListResult | null>(readRecentCache);
  const recentRef = useRef(recent);
  recentRef.current = recent;
  const { t, settings } = useSettings();
  // 그래프 뷰를 설정에서 끈 상태로 view 가 graph 에 남아 있으면 목록으로 폴백
  const activeView = view === 'graph' && !settings.graph.enabled ? 'worklogs' : view;

  const loadRecent = useCallback(async () => {
    const r = await window.cairn.listRecent();
    setRecent(r);
    try {
      localStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(r));
    } catch {
      /* empty */
    }
    return r;
  }, []);

  // 발행 완료 CTA — 노션으로 내보내지 않고 앱 안 드로어로 (목록에 없으면 갱신 후 재탐색)
  const openPublishedPage = useCallback(
    async (pageId: string, url: string | null) => {
      const inState = recentRef.current?.pages.find((p) => p.pageId === pageId);
      const page =
        inState ?? (await loadRecent().catch(() => null))?.pages.find((p) => p.pageId === pageId);
      if (page) {
        setView('worklogs');
        setSelectedPage(page);
      } else if (url) {
        void window.cairn.openExternal(url);
      }
    },
    [loadRecent],
  );

  useEffect(() => {
    localStorage.setItem('cairn:sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setSidebarWidth(Math.min(420, Math.max(200, ev.clientX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // 창 밖에서 버튼을 놓으면 mouseup 이 안 옴 — blur 로도 종료
    window.addEventListener('blur', onUp);
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    const trySync = (signedIn: boolean): void => {
      signedInRef.current = signedIn;
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
    const off = window.cairn.onRunStep(({ mode, step }) => {
      setSessions((prev) => {
        const current = prev[mode] ?? {
          state: 'running',
          step: 'boot',
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

  const [toast, setToast] = useState<RunToastData | null>(null);
  const toastTimer = useRef<number | null>(null);

  const recentRetryTimer = useRef<number | null>(null);
  useEffect(() => {
    const off = window.cairn.onRunDone(({ mode, result }) => {
      setSessions((prev) => {
        const current = prev[mode] ?? {
          state: 'running' as const,
          step: 'done' as const,
          startedAt: Date.now(),
        };
        return {
          ...prev,
          [mode]: { ...current, state: 'done', step: 'done', result, endedAt: Date.now() },
        };
      });
      setRunningMode((rm) => (rm === mode ? null : rm));
      if (!result.cancelled) {
        setToast({ mode, result, at: Date.now() });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 6000);
      }
      void loadRecent();
      // 노션 인덱싱 지연으로 방금 발행한 페이지가 첫 조회에 안 잡히는 경우 — 잠시 뒤 재조회
      // (연속 run-done 시 타이머 중첩 방지·cleanup 정리 — #241 리뷰)
      if (recentRetryTimer.current) window.clearTimeout(recentRetryTimer.current);
      recentRetryTimer.current = window.setTimeout(() => void loadRecent(), 5000);
      if (signedInRef.current) void window.cairn.cloud.syncNow().catch(() => {});
    });
    return () => {
      off();
      if (recentRetryTimer.current) window.clearTimeout(recentRetryTimer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [loadRecent]);

  // 창을 다시 볼 때 목록 최신화(자동 발행 등 외부 변화 인지) — 과호출 방지 60초 스로틀
  const lastFocusLoad = useRef(0);
  useEffect(() => {
    const onFocus = (): void => {
      const now = Date.now();
      if (now - lastFocusLoad.current < 60_000) return;
      lastFocusLoad.current = now;
      void loadRecent();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
      setPrefsOpen(false);
      setView('worklogs');
      setFilter(focused);
    });
    return off;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        // 팔레트를 열어둔 채 환경설정(radix modal)이 뜨면 body pointer-events 가 죽어 팔레트가 안 닫힘
        setCmdkOpen(false);
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
        // 라이브 run 의 라인은 지우면 안 됨 — 다른 mode 가 busy 일 때만 리셋 (기존 lines: [] 동작 유지)
        if (active.mode !== mode) resetRunLines(mode);
        setSessions((prev) => {
          if (prev[mode]?.state === 'running' || active.mode === mode) return prev;
          return {
            ...prev,
            [mode]: {
              state: 'done',
              step: 'boot',
              startedAt: Date.now(),
              endedAt: Date.now(),
              error: t('publish.busyMsg'),
            },
          };
        });
        return;
      }
      setRunningMode(mode);
      resetRunLines(mode);
      const batch = (options?.backfillDays ?? 0) > 0;
      setSessions((prev) => ({
        ...prev,
        [mode]: { state: 'running', step: 'boot', startedAt: Date.now(), batch },
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
        view={activeView}
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
        onOpenGraph={() => {
          setPrefsOpen(false);
          setView('graph');
        }}
        onOpenPreferences={() => setPrefsOpen(true)}
      />
      <div
        onMouseDown={startResize}
        className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40 [-webkit-app-region:no-drag]"
      />
      {activeView === 'stats' ? (
        <Dashboard
          recent={recent}
          onPickDate={(date) => {
            const p = recent?.pages.find((x) => x.category === 'daily' && x.date === date);
            if (p) setSelectedPage(p);
          }}
          onGoToWorklogs={() => setView('worklogs')}
        />
      ) : activeView === 'graph' ? (
        <GraphView recent={recent} onOpen={setSelectedPage} />
      ) : (
        <WorklogList
          recent={recent}
          filter={filter}
          sessions={sessions}
          runningMode={runningMode}
          onTrigger={trigger}
          onOpenPublished={(pageId, url) => void openPublishedPage(pageId, url)}
          onReload={loadRecent}
          onOpen={setSelectedPage}
          onAchievements={() => setAchvOpen(true)}
          drawerOpen={selectedPage !== null}
          publishProgressSignal={publishProgressSignal}
        />
      )}
      {selectedPage && <WorklogDrawer page={selectedPage} onClose={() => setSelectedPage(null)} />}
      <AnimatePresence>
        {cmdkOpen && (
          <CommandPalette
            recent={recent}
            onClose={() => setCmdkOpen(false)}
            onView={setView}
            onPreferences={() => setPrefsOpen(true)}
            onPublish={(mode) => {
              // 대시보드/그래프 뷰에서 팔레트로 발행하면 진행 표시가 없어 무반응처럼 보이던 문제 —
              // worklogs 뷰로 전환하고 진행 다이얼로그를 열어 스피너/단계를 보여준다
              setView('worklogs');
              setPublishProgressSignal((n) => n + 1);
              void trigger(mode);
            }}
            onOpenPage={setSelectedPage}
            onAchievements={() => setAchvOpen(true)}
          />
        )}
      </AnimatePresence>
      {achvOpen && <AchievementsDialog recent={recent} onClose={() => setAchvOpen(false)} />}
      <RunToast
        toast={toast}
        onClose={() => setToast(null)}
        onOpenPage={(pageId, url) => {
          void openPublishedPage(pageId, url);
          setToast(null);
        }}
      />
      <PreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        onRerunSetup={() => setSetupComplete(false)}
        blockEscape={cmdkOpen}
      />
    </div>
  );
}
