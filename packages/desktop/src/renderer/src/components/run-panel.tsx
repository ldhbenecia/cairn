import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Play } from 'lucide-react';
import type { CoreMode, CoreResult, CoreRunOptions } from '../cairn-api';
import type { RunSession } from '../App';

type Props = {
  mode: CoreMode;
  label: string;
  description: string;
  session: RunSession | null;
  otherRunning: boolean;
  onTrigger: (options?: CoreRunOptions) => Promise<void>;
};

export function RunPanel({ mode, label, description, session, otherRunning, onTrigger }: Props) {
  const tailRef = useRef<HTMLDivElement>(null);
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const isRunning = session?.state === 'running';
  const lines = session?.lines ?? [];

  useEffect(() => {
    tailRef.current?.scrollTo({ top: tailRef.current.scrollHeight });
  }, [lines.length]);

  const disabled = isRunning || otherRunning;

  return (
    <div className="flex flex-1 flex-col px-8 pb-8 [-webkit-app-region:no-drag]">
      <p className="mb-6 text-ink-subtle">{description}</p>

      {mode === 'daily' && (
        <label className="mb-4 inline-flex select-none items-center gap-2 self-start text-ink-muted">
          <input
            type="checkbox"
            checked={includeBackfill}
            onChange={(e) => setIncludeBackfill(e.target.checked)}
            disabled={disabled}
            className="accent-accent"
          />
          <span>이전 며칠 놓친 일지도 같이 채우기</span>
        </label>
      )}

      <button
        type="button"
        onClick={() => void onTrigger({ backfillDays: includeBackfill ? undefined : 0 })}
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

      {session?.state === 'done' && session.result && <Result result={session.result} />}

      {lines.length > 0 && (
        <div
          ref={tailRef}
          className="mt-6 flex-1 overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-4 font-mono text-[12px] leading-relaxed"
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
