import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Plus, X } from 'lucide-react';
import type { CoreMode, CoreResult, CoreRunOptions, RunStep } from '../cairn-api';
import type { RunSession } from '../App';
import { Toggle } from './toggle';

type Props = {
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
};

const MODE_OPTIONS: { mode: CoreMode; label: string }[] = [
  { mode: 'daily', label: '오늘' },
  { mode: 'weekly', label: '이번 주' },
  { mode: 'monthly', label: '이번 달' },
];

const STEPS: { key: RunStep; label: string }[] = [
  { key: 'collect', label: '활동 수집' },
  { key: 'summarize', label: 'AI 요약' },
  { key: 'publish', label: '노션 발행' },
];

const STEP_RANK: Record<RunStep, number> = {
  boot: 0,
  collect: 1,
  summarize: 2,
  publish: 3,
  done: 4,
};

const STEP_HINT: Record<RunStep, string> = {
  boot: '준비하는 중…',
  collect: 'GitHub · 로컬 Git · Notion 활동을 모으는 중',
  summarize: 'Claude 가 한국어로 요약하는 중 — 보통 1~2분 걸려요',
  publish: '노션에 발행하는 중',
  done: '완료',
};

export function PublishDialog({ sessions, runningMode, onTrigger }: Props) {
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
          발행
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/50 [-webkit-app-region:no-drag]" />
        <Dialog.Content className="dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-115 max-w-[90vw] flex-col rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 [-webkit-app-region:no-drag]">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <Dialog.Title className="text-[15px] font-semibold tracking-[-0.2px] text-ink">
              일지 발행
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-5">
            {showProgress && isDone && session?.result ? (
              <Result result={session.result} onClose={() => setOpen(false)} />
            ) : showProgress && (isRunning || busy) ? (
              <Progress session={session} />
            ) : (
              <>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                  발행 범위
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
                      {o.label}
                    </button>
                  ))}
                </div>

                <div className="mb-5 flex flex-col gap-3">
                  {/* backfill 은 일간 전용 — 주간/월간엔 비활성으로 표시(모달 높이 고정) */}
                  <Toggle
                    checked={mode === 'daily' && includeBackfill}
                    onChange={setIncludeBackfill}
                    disabled={busy || mode !== 'daily'}
                    label="이전 며칠 놓친 일지도 같이 채우기"
                  />
                  <Toggle
                    checked={force}
                    onChange={setForce}
                    disabled={busy}
                    label="이미 발행됐어도 덮어쓰기"
                  />
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowProgress(true);
                    void onTrigger(mode, {
                      backfillDays: mode === 'daily' && includeBackfill ? undefined : 0,
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
                  {busy ? '다른 작업 실행 중' : '발행 시작'}
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
function collectHint(lines: RunSession['lines']): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.line.toLowerCase();
    if (!t) continue;
    if (t.includes('notion')) return 'Notion 편집 내역 가져오는 중';
    if (t.includes('github')) return 'GitHub PR · 리뷰 · 커밋 불러오는 중';
    if (t.includes('local-git')) return '로컬 Git 커밋 읽는 중';
  }
  return STEP_HINT.collect;
}

function Progress({ session }: { session: RunSession | null }) {
  const step = session?.step ?? 'boot';
  const currentRank = STEP_RANK[step];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const hint = step === 'collect' ? collectHint(session?.lines ?? []) : STEP_HINT[step];

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
                {s.label}
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

function Result({ result, onClose }: { result: CoreResult; onClose: () => void }) {
  const url = result.notionUrl ?? pageIdToUrl(result.publishPageId);
  let body: React.ReactNode;
  if (!result.ok) {
    body = <p className="text-[#f87171]">실패 (exit {result.exitCode ?? 'unknown'})</p>;
  } else if (result.publishKind === 'no-target') {
    body = <p className="text-[#d4a574]">발행 대상 없음 — Preferences 에서 설정 확인</p>;
  } else if (result.noActivity) {
    body = <p className="text-ink-muted">활동 없음 — 발행 안 함</p>;
  } else if (result.publishKind === 'skipped') {
    body = <p className="text-ink-muted">이미 발행됨 — skip</p>;
  } else {
    body = (
      <p className="flex items-center gap-2 text-[15px] text-success">
        <Check size={18} strokeWidth={2.5} />
        발행 완료
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
            노션에서 열기
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
