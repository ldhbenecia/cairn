import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { LogTailResult } from '../cairn-api';

export function LogsPanel() {
  const [result, setResult] = useState<LogTailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const tailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await window.cairn.tailLogs();
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    tailRef.current?.scrollTo({ top: tailRef.current.scrollHeight });
  }, [result]);

  return (
    <div className="flex flex-1 flex-col px-8 pb-8 [-webkit-app-region:no-drag]">
      <div className="mb-4 flex items-center gap-3 text-ink-subtle">
        {result?.path ? (
          <span className="truncate font-mono text-[12px]">{result.path}</span>
        ) : (
          <span className="text-[12px]">
            로그 파일 없음 — ~/.cairn/logs/cairn-*.log 가 생긴 뒤 다시 시도
          </span>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={12} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {result && result.lines.length > 0 ? (
        <div
          ref={tailRef}
          className="flex-1 overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-4 font-mono text-[12px] leading-relaxed text-ink-muted"
        >
          {result.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="flex flex-1 items-center justify-center text-[12px] text-ink-tertiary">
            로그 비어 있음
          </div>
        )
      )}
    </div>
  );
}
