import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ConfigResult } from '../cairn-api';

export function SettingsPanel() {
  const [result, setResult] = useState<ConfigResult>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await window.cairn.readConfig();
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col px-8 pb-8 [-webkit-app-region:no-drag]">
      <div className="mb-4 flex items-center gap-3 text-ink-subtle">
        {result ? (
          <span className="truncate font-mono text-[12px]">{result.path}</span>
        ) : (
          <span className="text-[12px]">
            worklog.config.json 못 찾음 — cairn root 에 파일을 두고 다시 시도
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

      {result && (
        <pre className="flex-1 overflow-auto rounded-lg border border-hairline bg-surface-1 p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
          {result.raw}
        </pre>
      )}

      <p className="mt-6 flex items-start gap-2 text-[12px] text-ink-tertiary">
        <ExternalLink size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>
          GUI 편집은 v0.2 셋업 마법사부터. v0.2 시점에 config 위치도{' '}
          <span className="font-mono">~/.cairn/worklog.config.json</span> 으로 이전 (코드 안 까도
          되도록).
        </span>
      </p>
    </div>
  );
}
