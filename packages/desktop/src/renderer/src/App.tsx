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
import { invalidateReportsScan, prefetchReportsScan } from './lib/reports-scan';
import { resetRunLines } from './lib/run-line-store';
import { RunToast, type RunToastData } from './components/run-toast';
import { useSettings } from './settings-context';
import { Dashboard } from './components/dashboard';
import { GraphView } from './components/graph-view';
import { Onboarding } from './components/onboarding';
import { PreferencesDialog } from './components/preferences-dialog';
import { CommandPalette } from './components/command-palette';
import { ReportsView } from './components/reports-view';
import { StandupDialog } from './components/standup-dialog';
import { WrappedDialog } from './components/wrapped-dialog';
import { WorklogDetailView } from './components/worklog-detail-view';
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
  yearly: null,
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
  const [standupOpen, setStandupOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [setupComplete, setSetupComplete] = useState(window.cairn.initialSetupComplete);
  const [everSetup, setEverSetup] = useState(window.cairn.initialSetupComplete);
  const [selectedPage, setSelectedPage] = useState<RecentPage | null>(null);
  // 일지 상세 표시 모드 — 드로어(기본) 또는 메인 영역 전체(Linear 이슈 상세)
  const [detailFull, setDetailFull] = useState(false);
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

  // 어디서 열든 새 일지는 드로어부터 — 전체 화면은 드로어의 확장 버튼으로만 진입
  const openPage = useCallback((p: RecentPage) => {
    setDetailFull(false);
    setSelectedPage(p);
  }, []);

  // 명시적 뷰 전환은 전체 화면 상세·드로어 상태도 함께 정리 — detailFull 분기가 새 뷰를 가리는 문제 방지
  const switchView = useCallback((v: MainView) => {
    setPrefsOpen(false);
    setSelectedPage(null);
    setDetailFull(false);
    setView(v);
  }, []);

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
        openPage(page);
      } else if (url) {
        void window.cairn.openExternal(url);
      }
    },
    [loadRecent, openPage],
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
    // 로드 후 idle 시점에 기간별 정리 기본 기간(월)을 미리 스캔 — 뷰 첫 진입 시 스피너 제거
    void loadRecent().then((r) => {
      window.setTimeout(() => prefetchReportsScan(r), 3000);
    });
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
    let active = true;
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
      // 노션 인덱싱 지연으로 방금 발행한 페이지가 첫 조회에 안 잡히는 경우에만 잠시 뒤 재조회 —
      // 이미 잡혔으면 스킵해 발행당 노션 목록 조회를 절반으로 (연속 run-done 타이머 중첩 방지 — #241)
      if (recentRetryTimer.current) window.clearTimeout(recentRetryTimer.current);
      void loadRecent().then((r) => {
        // 언마운트 후 늦게 도착한 콜백이 새 타이머를 걸지 않도록 (누수·불필요 IPC 방지)
        if (!active) return;
        // 발행 직후 기간별 정리 캐시 무효화 후 기본 기간 재스캔 — 재발행(count 불변)도 반영
        invalidateReportsScan();
        prefetchReportsScan(r);
        const pid = result.publishPageId;
        const found = !pid || (r?.pages ?? []).some((p) => p.pageId === pid);
        if (found) return;
        recentRetryTimer.current = window.setTimeout(() => void loadRecent(), 5000);
      });
      if (signedInRef.current) void window.cairn.cloud.syncNow().catch(() => {});
    });
    return () => {
      active = false;
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
      switchView('worklogs');
      setFilter(focused);
    });
    return off;
  }, [switchView]);

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
      yearly: pages.filter((p) => p.category === 'yearly').length,
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
          switchView('worklogs');
          setFilter(f);
        }}
        onOpenStats={() => switchView('stats')}
        onOpenGraph={() => switchView('graph')}
        onOpenReports={() => switchView('reports')}
        onOpenPreferences={() => setPrefsOpen(true)}
        onOpenPalette={() => setCmdkOpen(true)}
      />
      <div
        onMouseDown={startResize}
        className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-hairline-tertiary [-webkit-app-region:no-drag]"
      />
      {selectedPage && detailFull ? (
        <WorklogDetailView
          page={selectedPage}
          onBack={() => {
            setDetailFull(false);
            setSelectedPage(null);
          }}
        />
      ) : activeView === 'stats' ? (
        <Dashboard
          recent={recent}
          onPickDate={(date) => {
            const p = recent?.pages.find((x) => x.category === 'daily' && x.date === date);
            if (p) openPage(p);
          }}
          onGoToWorklogs={() => setView('worklogs')}
          onOpenWrapped={() => setWrappedOpen(true)}
        />
      ) : activeView === 'graph' ? (
        <GraphView recent={recent} onOpen={openPage} />
      ) : activeView === 'reports' ? (
        <ReportsView recent={recent} />
      ) : (
        <WorklogList
          recent={recent}
          filter={filter}
          sessions={sessions}
          runningMode={runningMode}
          onTrigger={trigger}
          onOpenPublished={(pageId, url) => void openPublishedPage(pageId, url)}
          onReload={loadRecent}
          onOpen={openPage}
          drawerOpen={selectedPage !== null}
          publishProgressSignal={publishProgressSignal}
          onConsumePublishSignal={() => setPublishProgressSignal(0)}
        />
      )}
      {selectedPage && !detailFull && (
        <WorklogDrawer
          page={selectedPage}
          onClose={() => setSelectedPage(null)}
          onExpand={() => setDetailFull(true)}
        />
      )}
      <AnimatePresence>
        {cmdkOpen && (
          <CommandPalette
            key="command-palette"
            recent={recent}
            onClose={() => setCmdkOpen(false)}
            onView={switchView}
            onPreferences={() => setPrefsOpen(true)}
            onPublish={(mode) => {
              // 대시보드/그래프 뷰에서 팔레트로 발행하면 진행 표시가 없어 무반응처럼 보이던 문제 —
              // worklogs 뷰로 전환하고 진행 다이얼로그를 열어 스피너/단계를 보여준다
              switchView('worklogs');
              setPublishProgressSignal((n) => n + 1);
              void trigger(mode);
            }}
            onOpenPage={openPage}
            onStandup={() => setStandupOpen(true)}
            onQuickCapture={() => void window.cairn.capture.open()}
            onWrapped={() => setWrappedOpen(true)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {standupOpen && (
          <StandupDialog key="standup" recent={recent} onClose={() => setStandupOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {wrappedOpen && (
          <WrappedDialog key="wrapped" recent={recent} onClose={() => setWrappedOpen(false)} />
        )}
      </AnimatePresence>
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
