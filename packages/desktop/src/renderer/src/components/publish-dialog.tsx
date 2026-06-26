import * as Dialog from '@radix-ui/react-dialog';
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDotDashed,
  ExternalLink,
  type LucideIcon,
  Loader2,
  Plus,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { RunSession } from '../App';
import type {
  CoreMode,
  CoreResult,
  CoreRunOptions,
  DateStep,
  RunProgress,
  RunStep,
  SummaryModel,
} from '../cairn-api';
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

  // 외부(자동) 발행이 다른 mode 로 돌면 그 mode 세션을 보여줘야 진행 화면이 'boot' 에 고정 안 됨
  const activeMode = externalBusy && busyMode ? busyMode : mode;
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
          className={`dialog-content glass-panel fixed top-1/2 left-1/2 z-50 flex max-h-[82vh] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [-webkit-app-region:no-drag] ${
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
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-6 py-5">
            {showProgress && isDone && session?.error ? (
              <ErrorCard message={session.error} t={t} onClose={() => setOpen(false)} />
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

// raw 로그는 UI 에 노출하지 않고, 수집 중인 소스 판단에만 내부 사용
function collectHintKey(lines: RunSession['lines']): I18nKey {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.line.toLowerCase();
    if (!t) continue;
    if (t.includes('github')) return 'publish.hint.collectGithub';
    if (t.includes('local-git')) return 'publish.hint.collectGit';
  }
  return 'publish.hint.collect';
}

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

const SUMMARIZE_HINTS: I18nKey[] = [
  'publish.hint.summarize',
  'publish.hint.summarize.read',
  'publish.hint.summarize.commits',
  'publish.hint.summarize.numbers',
  'publish.hint.summarize.polish',
];

const STEP_SEQ: DateStep[] = ['collect', 'summarize', 'publish'];
const DSTEP_FULL: Record<DateStep, I18nKey> = {
  collect: 'publish.step.collect',
  summarize: 'publish.step.summarize',
  publish: 'publish.step.publish',
};
const DSTEP_SHORT: Record<DateStep, I18nKey> = {
  collect: 'publish.dstep.collect',
  summarize: 'publish.dstep.summarize',
  publish: 'publish.dstep.publish',
};
const DSTEP_DOING: Record<DateStep, I18nKey> = {
  collect: 'publish.dstep.collect.doing',
  summarize: 'publish.dstep.summarize.doing',
  publish: 'publish.dstep.publish.doing',
};
const DSTEP_DESC: Record<DateStep, I18nKey> = {
  collect: 'publish.dstep.collect.desc',
  summarize: 'publish.dstep.summarize.desc',
  publish: 'publish.dstep.publish.desc',
};

type DStatus = 'done' | 'active' | 'pending';
type Layout = 'tree' | 'compact';

type PanelDate = {
  date: string;
  dow: string;
  status: DStatus;
  sub: DateStep | null;
  steps: { step: DateStep; status: DStatus }[];
  counts?: { pr: number; commit: number };
};

function weekdayLabel(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
  });
}

function buildPanelDates(
  dates: string[],
  doneDates: string[],
  stepByDate: Record<string, DateStep>,
  countsByDate: Record<string, { pr: number; commit: number }>,
  lang: string,
): PanelDate[] {
  // 멤버십 기반 — 동시 완료 순서가 날짜 순서와 달라도 정확(인덱스 가정 제거)
  const doneSet = new Set(doneDates);
  return dates.map((date) => {
    const status: DStatus = doneSet.has(date) ? 'done' : stepByDate[date] ? 'active' : 'pending';
    const sub = status === 'active' ? (stepByDate[date] ?? 'collect') : null;
    const subIdx = sub ? STEP_SEQ.indexOf(sub) : -1;
    const steps = STEP_SEQ.map((step, j) => {
      const sStatus: DStatus =
        status === 'done'
          ? 'done'
          : status === 'pending'
            ? 'pending'
            : j < subIdx
              ? 'done'
              : j === subIdx
                ? 'active'
                : 'pending';
      return { step, status: sStatus };
    });
    return { date, dow: weekdayLabel(date, lang), status, sub, steps, counts: countsByDate[date] };
  });
}

const STATUS_BADGE: Record<DStatus, { key: I18nKey; cls: string }> = {
  done: { key: 'publish.status.done', cls: 'bg-emerald-500/15 text-emerald-400' },
  active: { key: 'publish.status.active', cls: 'bg-accent/15 text-accent-hover' },
  pending: { key: 'publish.status.pending', cls: 'bg-surface-2 text-ink-tertiary' },
};

function StatusIcon({ status, size }: { status: DStatus; size: number }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.7, rotate: 10 }}
        transition={{ duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
        className="flex items-center justify-center"
      >
        {status === 'done' ? (
          <CheckCircle2 size={size} strokeWidth={2.25} className="text-emerald-400" />
        ) : status === 'active' ? (
          <CircleDotDashed
            size={size}
            strokeWidth={2.25}
            className="animate-spin text-accent [animation-duration:3s]"
          />
        ) : (
          <Circle size={size} strokeWidth={2} className="text-ink-tertiary" />
        )}
      </motion.span>
    </AnimatePresence>
  );
}

function StatusBadge({ status, t }: { status: DStatus; t: T }) {
  const b = STATUS_BADGE[status];
  return (
    <motion.span
      key={status}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}
    >
      {t(b.key)}
    </motion.span>
  );
}

function LayoutToggle({
  layout,
  setLayout,
  t,
}: {
  layout: Layout;
  setLayout: (l: Layout) => void;
  t: T;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-hairline bg-surface-2 p-0.5">
      {(['tree', 'compact'] as Layout[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLayout(l)}
          className={[
            'rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors',
            layout === l
              ? 'bg-surface-1 text-ink shadow-sm'
              : 'text-ink-tertiary hover:text-ink-muted',
          ].join(' ')}
        >
          {t(l === 'tree' ? 'publish.layout.tree' : 'publish.layout.compact')}
        </button>
      ))}
    </div>
  );
}

function OverallBar({
  done,
  total,
  pct,
  mm,
  ss,
  t,
}: {
  done: number;
  total: number;
  pct: number;
  mm: string;
  ss: string;
  t: T;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex shrink-0 items-baseline gap-0.5 tabular-nums">
        <span
          key={done}
          className="batch-count font-mono text-[26px] font-semibold tracking-[-0.5px] text-ink"
        >
          {done}
        </span>
        <span className="font-mono text-[15px] text-ink-tertiary">/{total}</span>
        <span className="ml-0.5 font-mono text-[12px] text-ink-tertiary">
          {t('publish.backfill.daysSuffix')}
        </span>
      </div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="bar-flow h-full rounded-full"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>
      <span className="shrink-0 font-mono text-[12.5px] text-ink-tertiary">
        {mm}:{ss}
      </span>
    </div>
  );
}

function StepRow({
  step,
  status,
  open,
  onToggle,
  summarizeHint,
  t,
}: {
  step: DateStep;
  status: DStatus;
  open: boolean;
  onToggle: () => void;
  summarizeHint: string;
  t: T;
}) {
  const detail =
    status === 'active'
      ? step === 'summarize'
        ? summarizeHint
        : t(DSTEP_DOING[step])
      : status === 'done'
        ? t('publish.status.done')
        : t('publish.status.pending');
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-md py-1 pr-1 text-left transition-colors hover:bg-surface-2/40"
      >
        <span className="z-10 flex size-[16px] shrink-0 items-center justify-center rounded-full bg-surface-1">
          <StatusIcon status={status} size={13} />
        </span>
        <span
          className={[
            'text-[12px]',
            status === 'pending'
              ? 'text-ink-tertiary'
              : status === 'active'
                ? 'font-medium text-ink'
                : 'text-ink-muted',
          ].join(' ')}
        >
          {t(DSTEP_FULL[step])}
        </span>
        <ChevronRight
          size={12}
          strokeWidth={2.5}
          className={`ml-auto text-ink-subtle transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden"
          >
            <div className="pt-0.5 pr-2 pb-1.5 pl-[26px]">
              <p className="text-[11px] leading-relaxed text-ink-muted">{t(DSTEP_DESC[step])}</p>
              <p
                key={detail}
                className={[
                  'hint-fade mt-1 font-mono text-[11px]',
                  status === 'active' ? 'text-accent-hover' : 'text-ink-tertiary',
                ].join(' ')}
              >
                {detail}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TreeRow({
  d,
  i,
  open,
  onToggle,
  isStepOpen,
  onToggleStep,
  summarizeHint,
  t,
}: {
  d: PanelDate;
  i: number;
  open: boolean;
  onToggle: () => void;
  isStepOpen: (step: DateStep) => boolean;
  onToggleStep: (step: DateStep) => void;
  summarizeHint: string;
  t: T;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.18) }}
      className="relative"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2/40"
      >
        <span className="flex size-[18px] shrink-0 items-center justify-center">
          <StatusIcon status={d.status} size={18} />
        </span>
        <span
          className={[
            'font-mono text-[13px]',
            d.status === 'pending'
              ? 'text-ink-tertiary'
              : d.status === 'active'
                ? 'font-medium text-ink'
                : 'text-ink-muted',
          ].join(' ')}
        >
          {d.date}
        </span>
        <span className="text-[12px] text-ink-tertiary">{d.dow}</span>
        {d.counts && (
          <span className="font-mono text-[11px] text-ink-tertiary tabular-nums">
            PR {d.counts.pr} · {t('publish.collected.commits')} {d.counts.commit}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <StatusBadge status={d.status} t={t} />
          <ChevronRight
            size={13}
            strokeWidth={2.5}
            className={`text-ink-subtle transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden"
          >
            <div className="relative mr-1 mb-1 ml-[9px] pt-0.5 pb-1">
              <span
                className="pointer-events-none absolute top-1 bottom-3 left-[8px] border-l border-dashed border-hairline-strong"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                {d.steps.map((s) => (
                  <StepRow
                    key={s.step}
                    step={s.step}
                    status={s.status}
                    open={isStepOpen(s.step)}
                    onToggle={() => onToggleStep(s.step)}
                    summarizeHint={summarizeHint}
                    t={t}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function CompactRow({ d, i, t }: { d: PanelDate; i: number; t: T }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.012, 0.15) }}
      className={[
        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5',
        d.status === 'active' ? 'bg-accent/[0.06]' : '',
      ].join(' ')}
    >
      <span className="flex size-[16px] shrink-0 items-center justify-center">
        <StatusIcon status={d.status} size={16} />
      </span>
      <span
        className={[
          'font-mono text-[12.5px]',
          d.status === 'pending' ? 'text-ink-tertiary' : 'text-ink-muted',
        ].join(' ')}
      >
        {d.date}
      </span>
      <span className="text-[11px] text-ink-tertiary">{d.dow}</span>
      {d.counts && (
        <span className="font-mono text-[10.5px] text-ink-tertiary tabular-nums">
          PR {d.counts.pr} · {t('publish.collected.commits')} {d.counts.commit}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {d.steps.map((s) => (
          <span
            key={s.step}
            className={[
              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              s.status === 'done'
                ? 'bg-emerald-500/12 text-emerald-400'
                : s.status === 'active'
                  ? 'batch-pulse bg-accent/15 text-accent-hover'
                  : 'bg-surface-2 text-ink-tertiary',
            ].join(' ')}
          >
            {t(DSTEP_SHORT[s.step])}
          </span>
        ))}
      </div>
    </motion.li>
  );
}

function CancelButton({
  cancelling,
  onClick,
  t,
}: {
  cancelling: boolean;
  onClick: () => void;
  t: T;
}) {
  return (
    <button
      type="button"
      disabled={cancelling}
      onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[12px] leading-none text-ink-tertiary transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      {cancelling ? t('publish.cancelling') : t('publish.cancel')}
    </button>
  );
}

function Progress({
  session,
  t,
  onCancel,
}: {
  session: RunSession | null;
  t: T;
  onCancel: () => void;
}) {
  const { settings } = useSettings();
  const [cancelling, setCancelling] = useState(false);
  const [layout, setLayout] = useState<Layout>('tree');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleDate = (d: string): void =>
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const toggleStep = (key: string): void =>
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
  const backfill = session?.progress ?? null;
  const isBatch = session?.batch === true || backfill !== null;
  const hintIdx = step === 'summarize' ? Math.floor(elapsed / 8) % SUMMARIZE_HINTS.length : 0;
  const hint =
    step === 'collect'
      ? t(collectHintKey(lines))
      : step === 'summarize'
        ? t(SUMMARIZE_HINTS[hintIdx]!)
        : t(STEP_HINT_KEY[step]);

  const panelDates = backfill
    ? buildPanelDates(
        backfill.dates,
        backfill.doneDates,
        backfill.stepByDate,
        backfill.countsByDate,
        settings.language,
      )
    : [];
  const stepsDone =
    (backfill?.done ?? 0) * 3 +
    panelDates
      .filter((d) => d.status === 'active')
      .reduce((n, d) => n + d.steps.filter((s) => s.status === 'done').length, 0);
  const pct =
    backfill && backfill.total > 0 ? Math.round((stepsDone / (backfill.total * 3)) * 100) : 0;
  const allDone = backfill ? backfill.done >= backfill.total : false;
  // 날짜마다 다른 요약 문구가 돌도록 인덱스 오프셋 — 동시 요약 시 같은 문구 중복 방지
  const hintTick = Math.floor(elapsed / 4);
  const summarizeHintFor = (idx: number): string =>
    t(SUMMARIZE_HINTS[(hintTick + idx) % SUMMARIZE_HINTS.length]!);
  const activeIdx = panelDates.findIndex((d) => d.status === 'active');
  const activeDate = activeIdx >= 0 ? panelDates[activeIdx] : undefined;
  const currentAction = allDone
    ? t('publish.allDone')
    : activeDate?.sub === 'summarize'
      ? `${activeDate.date} · ${summarizeHintFor(activeIdx)}`
      : activeDate?.sub
        ? `${activeDate.date} · ${t(DSTEP_DOING[activeDate.sub])}`
        : t('publish.hint.boot');
  const cancel = (): void => {
    setCancelling(true);
    onCancel();
  };

  return (
    <div className="flex flex-col gap-4 py-1">
      {isBatch ? (
        backfill && backfill.dates.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[11.5px] text-ink-tertiary">
                {t('publish.subtitle')}
              </span>
              <LayoutToggle layout={layout} setLayout={setLayout} t={t} />
            </div>
            <OverallBar
              done={backfill.done}
              total={backfill.total}
              pct={pct}
              mm={mm}
              ss={ss}
              t={t}
            />
            <ul className="-mx-1 flex max-h-[44vh] flex-col gap-0.5 overflow-y-auto pr-0.5 pl-1">
              {panelDates.map((d, i) =>
                layout === 'tree' ? (
                  <TreeRow
                    key={d.date}
                    d={d}
                    i={i}
                    open={expandedDates.has(d.date)}
                    onToggle={() => toggleDate(d.date)}
                    isStepOpen={(s) => expandedSteps.has(`${d.date}|${s}`)}
                    onToggleStep={(s) => toggleStep(`${d.date}|${s}`)}
                    summarizeHint={summarizeHintFor(i)}
                    t={t}
                  />
                ) : (
                  <CompactRow key={d.date} d={d} i={i} t={t} />
                ),
              )}
            </ul>
            <div className="flex items-center gap-2.5 border-t border-hairline pt-3">
              <span
                className={`size-1.5 shrink-0 rounded-full ${allDone ? 'bg-emerald-400' : 'batch-pulse bg-accent'}`}
              />
              <span
                key={currentAction}
                className="hint-fade min-w-0 flex-1 truncate text-[12.5px] leading-none text-ink-muted"
              >
                {currentAction}
              </span>
              <span className="shrink-0 font-mono text-[11px] leading-none text-ink-tertiary">
                {backfill.total - backfill.done} {t('publish.backfill.remaining')}
              </span>
              <CancelButton cancelling={cancelling} onClick={cancel} t={t} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface-2 px-4 py-3.5">
              <span className="text-[13px] font-medium text-ink-muted">
                {t('publish.backfill.publishing')}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-1">
                <div className="progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
              </div>
              <span className="text-[11px] leading-relaxed text-ink-tertiary">
                {t('publish.backfill.concurrent')}
              </span>
            </div>
            <div className="flex justify-center pt-1">
              <CancelButton cancelling={cancelling} onClick={cancel} t={t} />
            </div>
          </>
        )
      ) : (
        <>
          <ul className="flex flex-col">
            {STEPS.map((s) => {
              const rank = STEP_RANK[s.key];
              const status: DStatus =
                rank < currentRank ? 'done' : rank === currentRank ? 'active' : 'pending';
              const isActive = status === 'active';
              return (
                <li key={s.key} className="flex flex-col">
                  <div className="flex items-center gap-2.5 py-1">
                    <span className="flex size-[20px] shrink-0 items-center justify-center">
                      <StatusIcon status={status} size={18} />
                    </span>
                    <span
                      className={[
                        'text-[13px] transition-colors',
                        status === 'pending'
                          ? 'text-ink-tertiary'
                          : isActive
                            ? 'font-medium text-ink'
                            : 'text-ink-muted',
                      ].join(' ')}
                    >
                      {t(s.labelKey)}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {isActive && (
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          {mm}:{ss}
                        </span>
                      )}
                      <StatusBadge status={status} t={t} />
                    </span>
                  </div>
                  {isActive && (
                    <div className="ml-[9px] flex flex-col gap-2 border-l border-dashed border-hairline-strong pb-2.5 pl-[20px]">
                      <span
                        key={hint}
                        className="hint-fade text-[12px] leading-relaxed text-ink-muted"
                      >
                        {hint}
                      </span>
                      {s.key === 'summarize' && (
                        <BrandMark size={24} className="cairn-breathe text-accent" />
                      )}
                      {rank >= STEP_RANK.summarize &&
                        counts.pr !== null &&
                        counts.commit !== null && (
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
                            <span className="rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5">
                              PR {counts.pr}
                            </span>
                            <span className="rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5">
                              {t('publish.collected.commits')} {counts.commit}
                            </span>
                            <span>{t('publish.collected')}</span>
                          </div>
                        )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex justify-center pt-1">
            <CancelButton cancelling={cancelling} onClick={cancel} t={t} />
          </div>
        </>
      )}
    </div>
  );
}

function pageIdToUrl(pageId: string | null): string | null {
  if (!pageId) return null;
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

function CancelledCard({
  progress,
  t,
  onClose,
}: {
  progress?: RunProgress;
  t: T;
  onClose: () => void;
}) {
  const partial = progress && progress.total > 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-4 py-6 text-center"
    >
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
        className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-tertiary"
      >
        <Ban size={22} strokeWidth={2} />
      </motion.span>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-medium text-ink">{t('publish.result.cancelled')}</p>
        {partial && (
          <p className="font-mono text-[12px] text-ink-tertiary tabular-nums">
            {progress.done} / {progress.total}
            {t('publish.backfill.daysSuffix')} {t('publish.cancelled.partial')}
          </p>
        )}
        <p className="mx-auto max-w-[330px] text-[12px] leading-relaxed text-balance text-ink-muted">
          {t('publish.cancelled.desc')}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 rounded-md border border-hairline px-3.5 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {t('publish.close')}
      </button>
    </motion.div>
  );
}

function ErrorCard({ message, t, onClose }: { message: string; t: T; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <p className="flex items-center gap-2 text-[15px] text-danger">
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
  if (result.summaryFailed) {
    body = (
      <p className="flex items-center gap-2 text-[15px] text-danger">
        <TriangleAlert size={18} strokeWidth={2.25} />
        {t('publish.result.summaryFailed')}
      </p>
    );
  } else if (!result.ok) {
    body = (
      <p className="text-danger">
        {t('publish.result.fail')} (exit {result.exitCode ?? 'unknown'})
      </p>
    );
  } else if (result.publishKind === 'no-target') {
    body = <p className="text-notice">{t('publish.result.noTarget')}</p>;
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
