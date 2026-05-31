import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ExternalLink, Loader2, Play } from 'lucide-react';
import type { CoreMode, CoreResult, CoreRunOptions, RunStep } from '../cairn-api';
import type { RunSession } from '../App';
import { Toggle } from './toggle';

type Props = {
  mode: CoreMode;
  label: string;
  description: string;
  session: RunSession | null;
  otherRunning: boolean;
  onTrigger: (options?: CoreRunOptions) => Promise<void>;
};

const STEPS: { key: RunStep; label: string }[] = [
  { key: 'boot', label: '부팅' },
  { key: 'collect', label: '수집' },
  { key: 'summarize', label: '요약' },
  { key: 'publish', label: '발행' },
];

const STEP_RANK: Record<RunStep, number> = {
  boot: 0,
  collect: 1,
  summarize: 2,
  publish: 3,
  done: 4,
};

export function RunPanel({ mode, label, description, session, otherRunning, onTrigger }: Props) {
  const tailRef = useRef<HTMLDivElement>(null);
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const [force, setForce] = useState(false);
  const [showRawLog, setShowRawLog] = useState(false);
  const isRunning = session?.state === 'running';
  const isDone = session?.state === 'done';
  const lines = session?.lines ?? [];
  const currentStep = session?.step ?? null;

  useEffect(() => {
    if (showRawLog) tailRef.current?.scrollTo({ top: tailRef.current.scrollHeight });
  }, [lines.length, showRawLog]);

  const disabled = isRunning || otherRunning;

  return (
    <div className="flex flex-col">
      <p className="mb-6 text-ink-subtle">{description}</p>

      <div className="mb-5 flex flex-col gap-3 self-start">
        {mode === 'daily' && (
          <Toggle
            checked={includeBackfill}
            onChange={setIncludeBackfill}
            disabled={disabled}
            label="이전 며칠 놓친 일지도 같이 채우기"
          />
        )}
        <Toggle
          checked={force}
          onChange={setForce}
          disabled={disabled}
          label="이미 발행됐어도 덮어쓰기"
        />
      </div>

      <button
        type="button"
        onClick={() =>
          void onTrigger({
            backfillDays: includeBackfill ? undefined : 0,
            force,
          })
        }
        disabled={disabled}
        className={[
          'self-start flex items-center gap-2 rounded-md px-3.5 py-2 text-[14px] font-medium leading-[1.2] transition-colors',
          disabled
            ? 'cursor-not-allowed bg-accent-focus text-white opacity-70'
            : 'bg-accent text-white hover:bg-accent-hover',
        ].join(' ')}
      >
        {isRunning ? (
          <>
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            실행 중...
          </>
        ) : otherRunning ? (
          <>
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            다른 작업 실행 중
          </>
        ) : (
          <>
            <Play size={14} strokeWidth={2} />
            {label}
          </>
        )}
      </button>

      {(isRunning || isDone) && currentStep && (
        <StepIndicator currentStep={currentStep} allDone={isDone && session?.result?.ok === true} />
      )}

      {session?.state === 'done' && session.result && <Result result={session.result} />}

      {lines.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowRawLog((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] text-ink-subtle hover:text-ink-muted"
          >
            {showRawLog ? (
              <ChevronDown size={13} strokeWidth={2} />
            ) : (
              <ChevronRight size={13} strokeWidth={2} />
            )}
            자세히 보기 ({lines.length} 줄)
          </button>
          {showRawLog && (
            <div
              ref={tailRef}
              className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-4 font-mono text-[12px] leading-relaxed"
            >
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === 'err'
                      ? 'text-[#f87171]'
                      : l.level === 'meta'
                        ? 'text-ink-tertiary'
                        : 'text-ink-muted'
                  }
                >
                  {l.line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ currentStep, allDone }: { currentStep: RunStep; allDone: boolean }) {
  const currentRank = STEP_RANK[currentStep];
  return (
    <div className="mt-6 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const rank = STEP_RANK[s.key];
        const status: 'pending' | 'active' | 'done' =
          allDone || rank < currentRank ? 'done' : rank === currentRank ? 'active' : 'pending';
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={[
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                status === 'done'
                  ? 'border-hairline bg-surface-1 text-ink-muted'
                  : status === 'active'
                    ? 'border-accent/40 bg-accent/10 text-ink'
                    : 'border-hairline bg-surface-1 text-ink-tertiary',
              ].join(' ')}
            >
              {status === 'done' ? (
                <Check size={12} strokeWidth={2.5} />
              ) : status === 'active' ? (
                <Loader2 size={12} strokeWidth={2} className="animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-40" />
              )}
              <span>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'h-px w-3 transition-colors',
                  status === 'done' ? 'bg-hairline-strong' : 'bg-hairline',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function pageIdToUrl(pageId: string | null): string | null {
  if (!pageId) return null;
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

function Result({ result }: { result: CoreResult }) {
  if (!result.ok) {
    return (
      <div className="mt-6 rounded-lg border border-hairline bg-surface-1 p-5">
        <p className="text-[#f87171]">실패 (exit {result.exitCode ?? 'unknown'})</p>
      </div>
    );
  }
  if (result.noActivity) {
    return (
      <div className="mt-6 rounded-lg border border-hairline bg-surface-1 p-5">
        <p className="text-ink-muted">활동 없음 — 발행 안 함</p>
      </div>
    );
  }

  const fallbackUrl = pageIdToUrl(result.publishPageId);
  const url = result.notionUrl ?? fallbackUrl;

  if (result.publishKind === 'skipped') {
    return (
      <div className="mt-6 rounded-lg border border-hairline bg-surface-1 p-5">
        <p className="text-ink-muted">오늘 일지가 이미 발행됨 — skip</p>
        {url && (
          <button
            type="button"
            onClick={() => void window.cairn.openExternal(url)}
            className="mt-2 inline-flex items-center gap-1.5 text-accent hover:text-accent-hover"
          >
            <ExternalLink size={13} strokeWidth={2} />
            기존 노션 페이지 열기
          </button>
        )}
      </div>
    );
  }

  if (url) {
    return (
      <div className="mt-6 rounded-lg border border-hairline bg-surface-1 p-5">
        <p className="text-success">발행 완료</p>
        <button
          type="button"
          onClick={() => void window.cairn.openExternal(url)}
          className="mt-2 inline-flex items-center gap-1.5 text-accent hover:text-accent-hover"
        >
          <ExternalLink size={13} strokeWidth={2} />
          노션 페이지 열기
        </button>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-lg border border-hairline bg-surface-1 p-5">
      <p className="text-ink-muted">발행 완료 — 노션 페이지 URL 못 찾음</p>
    </div>
  );
}
