import * as Dialog from '@radix-ui/react-dialog';
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  ExternalLink,
  type LucideIcon,
  Loader2,
  Plus,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { RunSession } from '../App';
import type { CoreMode, CoreResult, CoreRunOptions, RunStep, SummaryModel } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { BrandMark } from './brand-mark';
import { DatePicker } from './date-picker';
import { Toggle } from './toggle';

type T = (key: I18nKey) => string;

type Props = {
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
};

const MODE_OPTIONS: { mode: CoreMode; key: I18nKey; sub: I18nKey; icon: LucideIcon }[] = [
  { mode: 'daily', key: 'publish.today', sub: 'publish.scope.daily', icon: CalendarDays },
  { mode: 'weekly', key: 'publish.week', sub: 'publish.scope.weekly', icon: CalendarRange },
  { mode: 'monthly', key: 'publish.month', sub: 'publish.scope.monthly', icon: CalendarClock },
];

const STEPS: { key: RunStep; labelKey: I18nKey }[] = [
  { key: 'collect', labelKey: 'publish.step.collect' },
  { key: 'summarize', labelKey: 'publish.step.summarize' },
  { key: 'publish', labelKey: 'publish.step.publish' },
];

const STEP_RANK: Record<RunStep, number> = {
  boot: 0,
  collect: 1,
  summarize: 2,
  publish: 3,
  done: 4,
};

const STEP_HINT_KEY: Record<RunStep, I18nKey> = {
  boot: 'publish.hint.boot',
  collect: 'publish.hint.collect',
  summarize: 'publish.hint.summarize',
  publish: 'publish.hint.publish',
  done: 'publish.hint.publish',
};

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

export function PublishDialog({ sessions, runningMode, onTrigger }: Props) {
  const { t, settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CoreMode>('daily');
  const [date, setDate] = useState<string>(todayIso);
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const [force, setForce] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const isToday = date === todayIso();

  // runningMode 만으론 시작 시 자동 발행이 도는 걸 모르므로 전역 busy 를 따로 본다.
  const [externalBusy, setExternalBusy] = useState(false);
  useEffect(() => {
    void window.cairn.busyState().then((s) => setExternalBusy(s.busy));
    return window.cairn.onBusy((s) => setExternalBusy(s.busy));
  }, []);

  const session = sessions[mode];
  const busy = runningMode !== null || externalBusy;
  const isRunning = session?.state === 'running';
  const isDone = session?.state === 'done';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setShowProgress(busy);
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
          className="dialog-content glass-panel fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-115 max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 [-webkit-app-region:no-drag]"
        >
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <Dialog.Title className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.2px] text-ink">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent/12 text-accent-hover">
                <CalendarDays size={15} strokeWidth={2} />
              </span>
              {t('publish.title')}
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-6 py-5">
            {showProgress && isDone && session?.error ? (
              <ErrorCard message={session.error} t={t} onClose={() => setOpen(false)} />
            ) : showProgress && isDone && session?.result ? (
              <Result
                result={session.result}
                elapsedSec={
                  session.endedAt
                    ? Math.max(0, Math.floor((session.endedAt - session.startedAt) / 1000))
                    : null
                }
                modelLabel={MODEL_NAME[settings.summaryModel] || t('prefs.prompts.model.default')}
                t={t}
                onClose={() => setOpen(false)}
              />
            ) : showProgress && (isRunning || busy) ? (
              <Progress session={session} t={t} onCancel={() => void window.cairn.cancelRun()} />
            ) : (
              <>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                  {t('publish.scope')}
                </p>
                <div className="mb-4 grid grid-cols-3 gap-2">
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
                  <DatePicker value={date} max={todayIso()} disabled={busy} onChange={setDate} />
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
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowProgress(true);
                    void onTrigger(mode, {
                      backfillDays:
                        mode === 'daily' && isToday && includeBackfill ? DAILY_BACKFILL_DAYS : 0,
                      force,
                      // 오늘이면 date 생략(엔진 기본 동작), 과거 날짜면 그 날짜를 명시.
                      ...(isToday ? {} : { date }),
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

// raw 로그는 UI 에 노출하지 않고, 수집 중인 소스 판단에만 내부 사용.
function collectHintKey(lines: RunSession['lines']): I18nKey {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.line.toLowerCase();
    if (!t) continue;
    if (t.includes('github')) return 'publish.hint.collectGithub';
    if (t.includes('local-git')) return 'publish.hint.collectGit';
  }
  return 'publish.hint.collect';
}

// 엔진 로그의 prCount/commitCountTotal 추출 (pretty·JSON 양식 모두 매칭).
function collectedCounts(lines: RunSession['lines']): { pr: number | null; commit: number | null } {
  let pr: number | null = null;
  let commit: number | null = null;
  for (const l of lines) {
    const mPr = /prCount["':\s]+(\d+)/.exec(l.line);
    if (mPr) pr = Number(mPr[1]);
    const mCommit = /commitCountTotal["':\s]+(\d+)/.exec(l.line);
    if (mCommit) commit = Number(mCommit[1]);
  }
  return { pr, commit };
}

// 엔진의 "backfill progress" 로그에서 done/total 추출.
// pino-pretty 는 msg 줄과 done/total 필드 줄이 분리되므로, "backfill progress" 헤더 이후
// 다음 로그 엔트리(`[HH:MM:SS …]` 헤더) 전까지를 한 블록으로 보고 필드를 모은다. JSON 단일 라인도 처리.
function backfillProgress(lines: RunSession['lines']): { done: number; total: number } | null {
  let done = 0;
  let total = 0;
  let inBlock = false;
  for (const l of lines) {
    const text = l.line;
    if (/^\[\d{2}:\d{2}:\d{2}/.test(text)) inBlock = /backfill progress/.test(text);
    else if (text.includes('backfill progress')) inBlock = true;
    if (!inBlock) continue;
    const md = /done["':\s]+(\d+)/.exec(text);
    const mt = /total["':\s]+(\d+)/.exec(text);
    if (md) done = Math.max(done, Number(md[1]));
    if (mt) total = Math.max(total, Number(mt[1]));
  }
  return total > 1 ? { done, total } : null;
}

const SUMMARIZE_HINTS: I18nKey[] = [
  'publish.hint.summarize',
  'publish.hint.summarize.read',
  'publish.hint.summarize.commits',
  'publish.hint.summarize.numbers',
  'publish.hint.summarize.polish',
];

function Progress({
  session,
  t,
  onCancel,
}: {
  session: RunSession | null;
  t: T;
  onCancel: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const step = session?.step ?? 'boot';
  const currentRank = STEP_RANK[step];
  const running = session?.state === 'running';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const startedAt = session?.startedAt;
  const end = session?.endedAt ?? now;
  const elapsed = startedAt ? Math.max(0, Math.floor((end - startedAt) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const lines = session?.lines ?? [];
  const counts = useMemo(() => collectedCounts(lines), [lines]);
  const backfill = useMemo(() => backfillProgress(lines), [lines]);
  const hintIdx = step === 'summarize' ? Math.floor(elapsed / 8) % SUMMARIZE_HINTS.length : 0;
  const hint =
    step === 'collect'
      ? t(collectHintKey(lines))
      : step === 'summarize'
        ? t(SUMMARIZE_HINTS[hintIdx]!)
        : t(STEP_HINT_KEY[step]);

  const fillPct = Math.max(0, Math.min(100, ((currentRank - STEP_RANK.collect) / 2) * 100));
  return (
    <div className="flex flex-col gap-5 py-1">
      {backfill ? (
        // 백필은 날짜별로 수집·요약·발행이 동시에 도므로 단일 선형 스텝 대신 N/M 진행을 메인으로.
        <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface-2/50 px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-muted">
              {t('publish.backfill.publishing')}
            </span>
            <span className="font-mono text-[18px] font-semibold tracking-[-0.5px] text-ink">
              {backfill.done}/{backfill.total}
              <span className="ml-0.5 text-[12px] font-normal text-ink-tertiary">
                {t('publish.backfill.daysSuffix')}
              </span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${(backfill.done / backfill.total) * 100}%` }}
            />
          </div>
          <span className="text-[11px] leading-relaxed text-ink-tertiary">
            {t('publish.backfill.concurrent')}
          </span>
        </div>
      ) : (
        <div className="relative flex items-start justify-between px-3">
          <div className="absolute top-[11px] right-3 left-3 h-0.5 rounded-full bg-hairline" />
          <div
            className="absolute top-[11px] left-3 h-0.5 rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `calc((100% - 1.5rem) * ${fillPct / 100})` }}
          />
          {STEPS.map((s) => {
            const rank = STEP_RANK[s.key];
            const status =
              rank < currentRank ? 'done' : rank === currentRank ? 'active' : 'pending';
            return (
              <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex size-[22px] items-center justify-center rounded-full border-2 transition-all duration-300',
                    status === 'done'
                      ? 'border-accent bg-accent text-white'
                      : status === 'active'
                        ? 'border-accent bg-surface-1 text-accent'
                        : 'border-hairline-strong bg-surface-1 text-ink-tertiary',
                  ].join(' ')}
                >
                  {status === 'done' ? (
                    <Check size={12} strokeWidth={3} />
                  ) : status === 'active' ? (
                    <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current opacity-50" />
                  )}
                </div>
                <span
                  className={`text-[11px] transition-colors ${status === 'pending' ? 'text-ink-tertiary' : 'text-ink-muted'}`}
                >
                  {t(s.labelKey)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {step === 'summarize' && !backfill && (
        <div className="flex justify-center py-1.5">
          <BrandMark size={28} className="cairn-breathe text-accent" />
        </div>
      )}

      {/* 백필일 땐 일자별 바와 겹치지 않게 indeterminate 바 숨김 */}
      {!backfill && (
        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span key={hint} className="hint-fade min-w-0 truncate text-ink-muted">
          {hint}
        </span>
        <span className="shrink-0 font-mono text-ink-tertiary">
          {mm}:{ss}
        </span>
      </div>

      {!backfill && currentRank >= STEP_RANK.summarize && counts.pr !== null && counts.commit !== null && (
        <div className="flex items-center gap-1.5 text-[12px] text-ink-tertiary">
          <span className="rounded-md border border-hairline bg-surface-2 px-2 py-1">
            PR {counts.pr}
          </span>
          <span className="rounded-md border border-hairline bg-surface-2 px-2 py-1">
            {t('publish.collected.commits')} {counts.commit}
          </span>
          <span>{t('publish.collected')}</span>
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          disabled={cancelling}
          onClick={() => {
            setCancelling(true);
            onCancel();
          }}
          className="rounded-md px-3 py-1.5 text-[12px] text-ink-tertiary transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          {cancelling ? t('publish.cancelling') : t('publish.cancel')}
        </button>
      </div>
    </div>
  );
}

function pageIdToUrl(pageId: string | null): string | null {
  if (!pageId) return null;
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

function ErrorCard({ message, t, onClose }: { message: string; t: T; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <p className="flex items-center gap-2 text-[15px] text-[#f87171]">
        <TriangleAlert size={18} strokeWidth={2.25} />
        {t('publish.result.error')}
      </p>
      <p className="text-[13px] leading-relaxed text-ink-muted">{message}</p>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          {t('publish.close')}
        </button>
      </div>
    </div>
  );
}

function fmtElapsed(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function Result({
  result,
  elapsedSec,
  modelLabel,
  t,
  onClose,
}: {
  result: CoreResult;
  elapsedSec: number | null;
  modelLabel: string;
  t: T;
  onClose: () => void;
}) {
  const url = result.notionUrl ?? pageIdToUrl(result.publishPageId);
  const isSuccess =
    result.ok &&
    result.publishKind !== 'no-target' &&
    result.publishKind !== 'skipped' &&
    !result.noActivity;
  let body: React.ReactNode;
  if (result.cancelled) {
    body = <p className="text-ink-muted">{t('publish.result.cancelled')}</p>;
  } else if (!result.ok) {
    body = (
      <p className="text-[#f87171]">
        {t('publish.result.fail')} (exit {result.exitCode ?? 'unknown'})
      </p>
    );
  } else if (result.publishKind === 'no-target') {
    body = <p className="text-[#d4a574]">{t('publish.result.noTarget')}</p>;
  } else if (result.noActivity) {
    body = <p className="text-ink-muted">{t('publish.result.noActivity')}</p>;
  } else if (result.publishKind === 'skipped') {
    body = <p className="text-ink-muted">{t('publish.result.skipped')}</p>;
  } else {
    body = (
      <p className="flex items-center gap-2 text-[15px] text-success">
        <Check size={18} strokeWidth={2.5} />
        {t('publish.result.done')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex flex-col gap-1.5">
        {body}
        {isSuccess && (modelLabel || elapsedSec !== null) && (
          <p className="text-[12px] text-ink-tertiary">
            {[modelLabel, elapsedSec !== null ? fmtElapsed(elapsedSec) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {url && (
          <button
            type="button"
            onClick={() => void window.cairn.openExternal(url)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            <ExternalLink size={14} strokeWidth={2} />
            {t('publish.openNotion')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          {t('publish.close')}
        </button>
      </div>
    </div>
  );
}
