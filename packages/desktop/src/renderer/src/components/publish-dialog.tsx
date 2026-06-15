import * as Dialog from '@radix-ui/react-dialog';
import { Check, ExternalLink, Loader2, Plus, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { RunSession } from '../App';
import type { CoreMode, CoreResult, CoreRunOptions, RunStep, SummaryModel } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { BrandMark } from './brand-mark';
import { Toggle } from './toggle';

type T = (key: I18nKey) => string;

type Props = {
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
};

const MODE_OPTIONS: { mode: CoreMode; key: I18nKey }[] = [
  { mode: 'daily', key: 'publish.today' },
  { mode: 'weekly', key: 'publish.week' },
  { mode: 'monthly', key: 'publish.month' },
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

  // 전역 실행 상태(자동 발행 백필·트레이 포함) — 자기 트리거(runningMode) 만으로는
  // 시작 시 자동 발행이 도는 걸 모른다.
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
        <Dialog.Content className="dialog-content glass-panel fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-115 max-w-[90vw] flex-col rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 [-webkit-app-region:no-drag]">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <Dialog.Title className="text-[15px] font-semibold tracking-[-0.2px] text-ink">
              {t('publish.title')}
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-5">
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
              <Progress session={session} t={t} />
            ) : (
              <>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                  {t('publish.scope')}
                </p>
                <div className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-1">
                  {MODE_OPTIONS.map((o) => (
                    <button
                      key={o.mode}
                      type="button"
                      onClick={() => setMode(o.mode)}
                      className={[
                        'flex-1 rounded-md px-2 py-2 text-[13px] font-medium transition-colors',
                        mode === o.mode
                          ? 'bg-accent text-white'
                          : 'text-ink-subtle hover:text-ink-muted',
                      ].join(' ')}
                    >
                      {t(o.key)}
                    </button>
                  ))}
                </div>

                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[13px] text-ink">{t('publish.date')}</span>
                    <span className="text-[11px] text-ink-tertiary">{t('publish.dateHint')}</span>
                  </div>
                  <input
                    type="date"
                    value={date}
                    max={todayIso()}
                    disabled={busy}
                    onChange={(e) => setDate(e.target.value || todayIso())}
                    className="rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink focus:border-accent/50 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="mb-5 flex flex-col gap-3">
                  <Toggle
                    checked={mode === 'daily' && isToday && includeBackfill}
                    onChange={setIncludeBackfill}
                    disabled={busy || mode !== 'daily' || !isToday}
                    label={t('publish.backfill')}
                  />
                  <Toggle
                    checked={force}
                    onChange={setForce}
                    disabled={busy}
                    label={t('publish.force')}
                  />
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
                      // 오늘이면 date 생략 → 기존 기본 동작(daily=오늘·weekly=지난주·monthly=지난달·백필).
                      // 과거 날짜를 고르면 그 날짜를 명시 → daily=그날, weekly/monthly=그 날짜가 속한 기간.
                      ...(isToday ? {} : { date }),
                    });
                  }}
                  className={[
                    'flex w-full items-center justify-center rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors',
                    busy
                      ? 'cursor-not-allowed bg-accent-focus text-white/70'
                      : 'bg-accent text-white hover:bg-accent-hover',
                  ].join(' ')}
                >
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

// raw 로그는 노출하지 않고, 어떤 소스를 수집 중인지 판단하는 용도로만 내부 사용
function collectHintKey(lines: RunSession['lines']): I18nKey {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.line.toLowerCase();
    if (!t) continue;
    if (t.includes('github')) return 'publish.hint.collectGithub';
    if (t.includes('local-git')) return 'publish.hint.collectGit';
  }
  return 'publish.hint.collect';
}

// 수집 결과 카운트 — 엔진 로그의 prCount/commitCountTotal 필드만 추출 (pretty·JSON 양식 모두 매칭)
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

// 백필(여러 날 한 번에) 진행 — 엔진의 "backfill progress" 로그에서 done/total 추출
function backfillProgress(lines: RunSession['lines']): { done: number; total: number } | null {
  let done = 0;
  let total = 0;
  for (const l of lines) {
    if (!l.line.includes('backfill progress')) continue;
    const md = /done["':\s]+(\d+)/.exec(l.line);
    const mt = /total["':\s]+(\d+)/.exec(l.line);
    if (md) done = Math.max(done, Number(md[1]));
    if (mt) total = Number(mt[1]);
  }
  return total > 1 ? { done, total } : null;
}

// 요약(~2분) 동안 8초 간격으로 순환하는 상태 문구
const SUMMARIZE_HINTS: I18nKey[] = [
  'publish.hint.summarize',
  'publish.hint.summarize.read',
  'publish.hint.summarize.commits',
  'publish.hint.summarize.numbers',
  'publish.hint.summarize.polish',
];

function Progress({ session, t }: { session: RunSession | null; t: T }) {
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

  return (
    <div className="flex flex-col gap-5 py-1">
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const rank = STEP_RANK[s.key];
          const status = rank < currentRank ? 'done' : rank === currentRank ? 'active' : 'pending';
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className={[
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                  status === 'done'
                    ? 'border-hairline bg-surface-2 text-ink-muted'
                    : status === 'active'
                      ? 'border-accent/50 bg-accent/15 text-ink'
                      : 'border-hairline bg-surface-2 text-ink-tertiary',
                ].join(' ')}
              >
                {status === 'done' ? (
                  <Check size={12} strokeWidth={2.5} className="text-success" />
                ) : status === 'active' ? (
                  <Loader2 size={12} strokeWidth={2} className="animate-spin text-accent" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current opacity-40" />
                )}
                {t(s.labelKey)}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-2 bg-hairline" />}
            </div>
          );
        })}
      </div>

      {backfill && (
        <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2/50 px-3 py-2.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-medium text-ink-muted">{t('publish.backfill.publishing')}</span>
            <span className="font-mono text-ink">
              {backfill.done}/{backfill.total}
              {t('publish.backfill.daysSuffix')}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(backfill.done / backfill.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {step === 'summarize' && !backfill && (
        <div className="flex justify-center py-1.5">
          <BrandMark size={28} className="cairn-breathe text-accent" />
        </div>
      )}

      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
      </div>

      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span key={hint} className="hint-fade min-w-0 truncate text-ink-muted">
          {hint}
        </span>
        <span className="shrink-0 font-mono text-ink-tertiary">
          {mm}:{ss}
        </span>
      </div>

      {currentRank >= STEP_RANK.summarize && counts.pr !== null && counts.commit !== null && (
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
  if (!result.ok) {
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
