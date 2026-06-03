import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Plus, X } from 'lucide-react';
import type { CoreMode, CoreResult, CoreRunOptions, RunStep } from '../cairn-api';
import type { RunSession } from '../App';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
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

export function PublishDialog({ sessions, runningMode, onTrigger }: Props) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CoreMode>('daily');
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const [force, setForce] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const session = sessions[mode];
  const busy = runningMode !== null;
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
            {showProgress && isDone && session?.result ? (
              <Result result={session.result} t={t} onClose={() => setOpen(false)} />
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

                <div className="mb-5 flex flex-col gap-3">
                  <Toggle
                    checked={mode === 'daily' && includeBackfill}
                    onChange={setIncludeBackfill}
                    disabled={busy || mode !== 'daily'}
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
                      backfillDays: mode === 'daily' && includeBackfill ? DAILY_BACKFILL_DAYS : 0,
                      force,
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
    if (t.includes('notion')) return 'publish.hint.collectNotion';
    if (t.includes('github')) return 'publish.hint.collectGithub';
    if (t.includes('local-git')) return 'publish.hint.collectGit';
  }
  return 'publish.hint.collect';
}

function Progress({ session, t }: { session: RunSession | null; t: T }) {
  const step = session?.step ?? 'boot';
  const currentRank = STEP_RANK[step];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const hint =
    step === 'collect' ? t(collectHintKey(session?.lines ?? [])) : t(STEP_HINT_KEY[step]);

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

      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <span className="text-ink-muted">{hint}</span>
        <span className="font-mono text-ink-tertiary">
          {mm}:{ss}
        </span>
      </div>
    </div>
  );
}

function pageIdToUrl(pageId: string | null): string | null {
  if (!pageId) return null;
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

function Result({ result, t, onClose }: { result: CoreResult; t: T; onClose: () => void }) {
  const url = result.notionUrl ?? pageIdToUrl(result.publishPageId);
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
      {body}
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
