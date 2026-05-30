import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ConfigResult } from '../cairn-api';

export function SettingsPanel() {
  const [result, setResult] = useState<ConfigResult | null>(null);
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
        {result && <span className="truncate font-mono text-[12px]">{result.path}</span>}
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

      {result?.raw ? (
        <pre className="flex-1 overflow-auto rounded-lg border border-hairline bg-surface-1 p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
          {result.raw}
        </pre>
      ) : (
        result && (
          <div className="rounded-lg border border-hairline bg-surface-1 p-5 text-[13px] text-ink-muted">
            파일이 위 경로에 없습니다. 한 번 셋업이 필요해요:
            <pre className="mt-3 overflow-auto rounded-md bg-canvas p-3 font-mono text-[12px] text-ink-subtle">{`mkdir -p ~/.cairn\ncp worklog.config.json .env ~/.cairn/`}</pre>
          </div>
        )
      )}

      <p className="mt-6 flex items-start gap-2 text-[12px] text-ink-tertiary">
        <ExternalLink size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>GUI 편집은 v0.2 셋업 마법사부터.</span>
      </p>
    </div>
  );
}
