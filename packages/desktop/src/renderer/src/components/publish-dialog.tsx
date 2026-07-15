import * as Dialog from '@radix-ui/react-dialog';
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  type LucideIcon,
  Loader2,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RunSession } from '../App';
import type { CoreMode, CoreRunOptions, SummaryModel } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { DatePicker } from './date-picker';
import { Progress } from './publish-dialog-progress';
import { CancelledCard, ErrorCard, Result } from './publish-dialog-result';
import { Toggle } from './toggle';

type Props = {
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  // 커맨드 팔레트 등 외부에서 '진행 화면으로 열기'를 요청하는 신호 (증가할 때마다 오픈)
  openProgressSignal?: number;
  // 신호 소비 후 부모 상태를 리셋 — 뷰 전환 후 재마운트 때 옛 신호로 다시 열리는 것 방지
  onConsumeSignal?: () => void;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
  onOpenPublished: (pageId: string, url: string | null) => void;
};

// 최근 실패 결과를 오픈 시 자동 회수할 시간 창 (30분) — 그 이후는 stale 로 안 띄운다
const RECALL_WINDOW_MS = 30 * 60_000;

// 가장 최근에 '실패'로 끝난 완료 세션 — !ok / 요약 실패 / 에러. 성공은 회수 대상 아님
function mostRecentFailed(
  sessions: Record<CoreMode, RunSession | null>,
): { mode: CoreMode; endedAt: number } | null {
  let best: { mode: CoreMode; endedAt: number } | null = null;
  for (const mode of ['daily', 'weekly', 'monthly', 'yearly'] as CoreMode[]) {
    const s = sessions[mode];
    if (s?.state !== 'done' || !s.endedAt) continue;
    const failed = !!s.error || (!!s.result && (!s.result.ok || s.result.summaryFailed));
    if (failed && (!best || s.endedAt > best.endedAt)) best = { mode, endedAt: s.endedAt };
  }
  return best;
}

const MODE_OPTIONS: { mode: CoreMode; key: I18nKey; sub: I18nKey; icon: LucideIcon }[] = [
  { mode: 'daily', key: 'publish.today', sub: 'publish.scope.daily', icon: CalendarDays },
  { mode: 'weekly', key: 'publish.week', sub: 'publish.scope.weekly', icon: CalendarRange },
  { mode: 'monthly', key: 'publish.month', sub: 'publish.scope.monthly', icon: CalendarClock },
  { mode: 'yearly', key: 'publish.year', sub: 'publish.scope.yearly', icon: CalendarCheck },
];

const DAILY_BACKFILL_DAYS = 7;

const pad2 = (n: number): string => String(n).padStart(2, '0');
const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const MODEL_NAME: Record<SummaryModel, string> = {
  default: '',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
  opus: 'Opus',
};

export function PublishDialog({
  sessions,
  runningMode,
  onTrigger,
  onOpenPublished,
  openProgressSignal,
  onConsumeSignal,
}: Props) {
  const { t, settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CoreMode>('daily');
  const [date, setDate] = useState<string>(todayIso);
  const dateTouched = useRef(false);
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const [force, setForce] = useState(false);
  const [skipNotion, setSkipNotion] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  // 최근 실패 결과를 오픈 시 1회만 자동 회수 — 같은 결과를 재오픈 때마다 다시 띄우지 않게
  const recalledEndedAt = useRef(0);
  const isToday = date === todayIso();

  // 열 때마다 재조회 — 연동 변경 반영
  useEffect(() => {
    if (!open) return;
    void window.cairn
      .readConfig()
      .then((c) => {
        const ws = (c.parsed as { notionWorkspaces?: unknown[] } | null)?.notionWorkspaces;
        setNotionConnected(Array.isArray(ws) && ws.length > 0);
      })
      .catch(() => {});
  }, [open]);

  // runningMode 만으론 시작 시 자동 발행이 도는 걸 모르므로 전역 busy·mode 를 따로 확인
  const [externalBusy, setExternalBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<CoreMode | null>(null);
  useEffect(() => {
    void window.cairn.busyState().then((s) => {
      setExternalBusy(s.busy);
      setBusyMode(s.mode);
    });
    return window.cairn.onBusy((s) => {
      setExternalBusy(s.busy);
      setBusyMode(s.mode);
    });
  }, []);

  // 외부(자동) 발행이 다른 mode 로 돌면 그 mode 세션을 보여줘야 진행 화면이 'boot' 에 고정 안 됨.
  // 종료 시 busy=false 가 run-done 보다 먼저 오므로, 보던 mode 를 latch 해 결과 화면이 폼으로 튕기지 않게.
  const [watchedExternal, setWatchedExternal] = useState<CoreMode | null>(null);
  useEffect(() => {
    if (externalBusy && busyMode) setWatchedExternal(busyMode);
  }, [externalBusy, busyMode]);
  useEffect(() => {
    if (!showProgress) setWatchedExternal(null);
  }, [showProgress]);
  // 팔레트 발행처럼 외부에서 요청하면 진행 화면으로 즉시 오픈 — 무피드백 방지 (초기 undefined 무시)
  useEffect(() => {
    if (openProgressSignal === undefined || openProgressSignal === 0) return;
    setShowProgress(true);
    setOpen(true);
    onConsumeSignal?.();
  }, [openProgressSignal, onConsumeSignal]);

  const activeMode = externalBusy && busyMode ? busyMode : (watchedExternal ?? mode);
  const session = sessions[activeMode];
  const busy = runningMode !== null || externalBusy;
  const isRunning = session?.state === 'running';
  const isDone = session?.state === 'done';
  const wide = showProgress && (isRunning || isDone || busy);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          // 진행 중이면 진행 화면. 아니면, 방금(30분 내) 실패로 끝난 결과가 아직 확인 전이면
          // 결과 화면을 먼저 — 6초 토스트가 유일해 실패를 다시 볼 수 없던 문제
          if (busy) {
            setShowProgress(true);
          } else {
            const failed = mostRecentFailed(sessions);
            if (
              failed &&
              Date.now() - failed.endedAt < RECALL_WINDOW_MS &&
              failed.endedAt !== recalledEndedAt.current
            ) {
              setMode(failed.mode);
              setShowProgress(true);
              recalledEndedAt.current = failed.endedAt;
            } else {
              setShowProgress(false);
            }
          }
          // 자정을 넘겨 열면 mount 시점의 어제 날짜가 남아 있음 — 사용자가 직접 고른 날짜는 유지 (#236 리뷰)
          if (!dateTouched.current) setDate((prev) => (prev === todayIso() ? prev : todayIso()));
          if (!busy) setSkipNotion(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-white transition-colors hover:bg-accent-hover [-webkit-app-region:no-drag]"
        >
          {busy ? (
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          ) : (
            <Plus size={14} strokeWidth={2.25} />
          )}
          {t('publish.button')}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/50 [-webkit-app-region:no-drag]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`dialog-content glass-panel fixed top-1/2 left-1/2 z-50 flex max-h-[82vh] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [-webkit-app-region:no-drag] ${
            wide ? 'w-[560px]' : 'w-[440px]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <Dialog.Title className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.2px] text-ink">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent/12 text-accent-hover">
                <CalendarDays size={15} strokeWidth={2} />
              </span>
              {t('publish.title')}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('publish.close')}
              className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-6 py-5">
            {showProgress && isDone && session?.error ? (
              <ErrorCard
                message={session.error}
                t={t}
                onClose={() => setOpen(false)}
                onNewPublish={busy ? undefined : () => setShowProgress(false)}
              />
            ) : showProgress && isDone && session?.result?.cancelled ? (
              <CancelledCard progress={session.progress} t={t} onClose={() => setOpen(false)} />
            ) : showProgress && isDone && session?.result ? (
              <Result
                result={session.result}
                elapsedSec={
                  session.endedAt && session.startedAt > 0
                    ? Math.max(0, Math.floor((session.endedAt - session.startedAt) / 1000))
                    : null
                }
                modelLabel={MODEL_NAME[settings.summaryModel] || t('prefs.prompts.model.default')}
                t={t}
                onClose={() => setOpen(false)}
                onOpenPublished={onOpenPublished}
                onNewPublish={busy ? undefined : () => setShowProgress(false)}
              />
            ) : showProgress && (isRunning || busy) ? (
              <Progress
                session={session}
                mode={activeMode}
                t={t}
                onCancel={() => void window.cairn.cancelRun()}
              />
            ) : (
              <>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                  {t('publish.scope')}
                </p>
                <div className="mb-4 grid grid-cols-4 gap-2">
                  {MODE_OPTIONS.map((o) => {
                    const selected = mode === o.mode;
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.mode}
                        type="button"
                        onClick={() => setMode(o.mode)}
                        className={[
                          'relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3.5 transition-all active:scale-[0.98]',
                          selected
                            ? 'border-accent bg-accent/10 shadow-sm shadow-accent/15'
                            : 'border-hairline hover:border-hairline-strong hover:bg-surface-2/60',
                        ].join(' ')}
                      >
                        {selected && (
                          <Check
                            size={13}
                            strokeWidth={3}
                            className="absolute top-2 right-2 text-accent"
                          />
                        )}
                        <Icon
                          size={20}
                          strokeWidth={1.75}
                          className={selected ? 'text-accent' : 'text-ink-tertiary'}
                        />
                        <span
                          className={`text-[13px] font-medium ${selected ? 'text-ink' : 'text-ink-muted'}`}
                        >
                          {t(o.key)}
                        </span>
                        <span className="text-[11px] text-ink-tertiary">{t(o.sub)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-2/50 px-3.5 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium text-ink">{t('publish.date')}</span>
                    <span className="text-[11px] text-ink-tertiary">{t('publish.dateHint')}</span>
                  </div>
                  <DatePicker
                    value={date}
                    max={todayIso()}
                    disabled={busy}
                    onChange={(iso) => {
                      dateTouched.current = true;
                      setDate(iso);
                    }}
                  />
                </div>

                <div className="mb-5 flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <span
                      className={`text-[13px] ${mode === 'daily' && isToday ? 'text-ink' : 'text-ink-tertiary'}`}
                    >
                      {t('publish.backfill')}
                    </span>
                    <Toggle
                      checked={mode === 'daily' && isToday && includeBackfill}
                      onChange={setIncludeBackfill}
                      disabled={busy || mode !== 'daily' || !isToday}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <span className="text-[13px] text-ink">{t('publish.force')}</span>
                    <Toggle checked={force} onChange={setForce} disabled={busy} />
                  </div>
                  {notionConnected && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] text-ink">{t('publish.skipNotion')}</span>
                        <span className="text-[11px] text-ink-tertiary">
                          {t('publish.skipNotionDesc')}
                        </span>
                      </div>
                      <Toggle checked={skipNotion} onChange={setSkipNotion} disabled={busy} />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    // 이전 외부 발행에서 latch 된 mode 가 새 수동 발행 화면을 끌고 가지 않게 (#236 리뷰)
                    setWatchedExternal(null);
                    setShowProgress(true);
                    void onTrigger(mode, {
                      backfillDays:
                        mode === 'daily' && isToday && includeBackfill ? DAILY_BACKFILL_DAYS : 0,
                      force,
                      ...(isToday ? {} : { date }),
                      ...(notionConnected && skipNotion ? { skipNotion: true } : {}),
                    });
                  }}
                  className={[
                    'flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.99]',
                    busy
                      ? 'cursor-not-allowed bg-accent-focus text-white/70'
                      : 'bg-accent text-white shadow-sm shadow-accent/25 hover:bg-accent-hover',
                  ].join(' ')}
                >
                  {!busy && <Send size={15} strokeWidth={2.25} />}
                  {busy ? t('publish.busy') : t('publish.start')}
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
