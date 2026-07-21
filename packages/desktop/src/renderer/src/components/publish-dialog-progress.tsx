import { CheckCircle2, ChevronRight, Circle, CircleDotDashed, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { RunSession } from '../App';
import type { CoreMode, DateStep, RunStep } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useRunLines } from '../lib/run-line-store';
import { useSettings } from '../settings-context';
import { BrandMark } from './brand-mark';
import {
  buildPanelDates,
  collectHintKey,
  collectedCounts,
  parseRollupDailies,
  type DStatus,
  type PanelDate,
  type T,
} from './publish-dialog-utils';

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

const SUMMARIZE_HINTS: I18nKey[] = [
  'publish.hint.summarize',
  'publish.hint.summarize.read',
  'publish.hint.summarize.commits',
  'publish.hint.summarize.numbers',
  'publish.hint.summarize.polish',
];

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

type Layout = 'tree' | 'compact';

// 칩은 무채 소형(border-hairline) — 상태 색은 좌측 아이콘이 담당, 실패만 텍스트로 시맨틱 유지
const STATUS_BADGE: Record<DStatus, { key: I18nKey; cls: string }> = {
  done: { key: 'publish.status.done', cls: 'text-ink-muted' },
  active: { key: 'publish.status.active', cls: 'text-ink' },
  pending: { key: 'publish.status.pending', cls: 'text-ink-tertiary' },
  failed: { key: 'publish.status.failed', cls: 'text-danger' },
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
          <CheckCircle2 size={size} strokeWidth={2.25} className="text-success" />
        ) : status === 'failed' ? (
          <XCircle size={size} strokeWidth={2.25} className="text-danger" />
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
      className={`shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}
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
        : status === 'failed'
          ? t('publish.status.failed')
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
                  status === 'active' ? 'text-ink-muted' : 'text-ink-tertiary',
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
        className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-surface-2/50"
      >
        <span className="flex size-[18px] shrink-0 items-center justify-center">
          <StatusIcon status={d.status} size={16} />
        </span>
        <span
          className={[
            'text-[13px] font-medium',
            d.status === 'pending'
              ? 'text-ink-tertiary'
              : d.status === 'active'
                ? 'text-ink'
                : 'text-ink-muted',
          ].join(' ')}
        >
          {d.date}
        </span>
        <span className="text-[11.5px] text-ink-tertiary">{d.dow}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {d.counts && (
            <span className="font-mono text-[11px] text-ink-tertiary tabular-nums">
              PR {d.counts.pr} · {t('publish.collected.commits')} {d.counts.commit}
            </span>
          )}
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
        // 트리 행과 동일 메트릭 — 레이아웃 전환 시 모달 크기가 출렁이지 않게
        'flex h-9 items-center gap-2.5 rounded-md px-2',
        d.status === 'active' ? 'bg-surface-2' : '',
      ].join(' ')}
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center">
        <StatusIcon status={d.status} size={16} />
      </span>
      <span
        className={[
          'text-[13px] font-medium',
          d.status === 'pending' ? 'text-ink-tertiary' : 'text-ink-muted',
        ].join(' ')}
      >
        {d.date}
      </span>
      <span className="text-[11.5px] text-ink-tertiary">{d.dow}</span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {d.counts && (
          <span className="font-mono text-[11px] text-ink-tertiary tabular-nums">
            PR {d.counts.pr} · {t('publish.collected.commits')} {d.counts.commit}
          </span>
        )}
        <span className="flex items-center gap-1">
          {d.steps.map((s) => (
            <span
              key={s.step}
              className={[
                'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                s.status === 'done'
                  ? 'border-hairline text-ink-muted'
                  : s.status === 'failed'
                    ? 'border-danger/40 text-danger'
                    : s.status === 'active'
                      ? 'batch-pulse border-hairline-strong text-ink'
                      : 'border-hairline text-ink-tertiary',
              ].join(' ')}
            >
              {t(DSTEP_SHORT[s.step])}
            </span>
          ))}
        </span>
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

export function Progress({
  session,
  mode,
  t,
  onCancel,
}: {
  session: RunSession | null;
  mode: CoreMode;
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
  const lines = useRunLines(mode);
  const counts = useMemo(() => collectedCounts(lines), [lines]);
  const rollupDailies = useMemo(() => parseRollupDailies(lines), [lines]);
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
        backfill.failedDates ?? [],
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
                className={`size-1.5 shrink-0 rounded-full ${allDone ? 'bg-success' : 'batch-pulse bg-accent'}`}
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
          {rollupDailies.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface-2 px-4 py-3">
              <span className="text-[12px] font-medium text-ink-muted">
                {t('publish.rollup.title')}
              </span>
              <div className="flex flex-wrap gap-1">
                {rollupDailies.map((d) => (
                  <span
                    key={d}
                    className="rounded border border-hairline bg-surface-1 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-tertiary"
                  >
                    {d.slice(5)}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-center pt-1">
            <CancelButton cancelling={cancelling} onClick={cancel} t={t} />
          </div>
        </>
      )}
    </div>
  );
}
