import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { RecentListResult, RecentPage } from '../cairn-api';

type Props = {
  recent: RecentListResult | null;
  onReload: () => Promise<void>;
};

export function RecentPanel({ recent, onReload }: Props) {
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      await onReload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col [-webkit-app-region:no-drag]">
      <div className="mb-3 flex items-center gap-3 px-8 text-ink-subtle">
        <span className="text-[12px]">
          {recent && (recent.pages.length > 0 ? `${recent.pages.length} 개` : '발행된 일지 없음')}
        </span>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={12} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {!recent ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-ink-tertiary">
          <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          노션 DB 조회 중...
        </div>
      ) : recent.pages.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-y border-hairline text-[11px] uppercase tracking-wider text-ink-tertiary">
                <th className="w-32 px-3 py-2 text-left font-medium">날짜</th>
                <th className="w-20 py-2 pr-3 text-left font-medium">상태</th>
                <th className="py-2 pr-3 text-left font-medium">제목</th>
                <th className="w-32 px-3 py-2 text-left font-medium">워크스페이스</th>
              </tr>
            </thead>
            <tbody>
              {recent.pages.map((p) => (
                <PageRow key={p.pageId} page={p} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-[12px] text-ink-tertiary">
          발행된 일지 없음
        </div>
      )}

      {recent && recent.warnings.length > 0 && (
        <div className="mx-8 mt-4 rounded-md border border-hairline bg-surface-1 p-3 text-[12px] text-ink-tertiary">
          <p className="mb-1 font-medium text-ink-subtle">경고</p>
          {recent.warnings.map((w, i) => (
            <p key={i} className="font-mono">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'border-[#7a5c3a]/40 bg-[#7a5c3a]/15 text-[#d4a574]',
  final: 'border-success/40 bg-success/15 text-success',
};

function PageRow({ page }: { page: RecentPage }) {
  return (
    <tr
      className="cursor-pointer border-b border-hairline transition-colors hover:bg-surface-2"
      onClick={() => page.url && void window.cairn.openExternal(page.url)}
    >
      <td className="px-3 py-2 font-mono whitespace-nowrap text-ink-muted">{page.date ?? '—'}</td>
      <td className="py-2 pr-3">
        {page.status && (
          <span
            className={[
              'inline-block rounded border px-1.5 py-px text-[11px]',
              STATUS_STYLE[page.status] ?? 'border-hairline text-ink-tertiary',
            ].join(' ')}
          >
            {page.status}
          </span>
        )}
      </td>
      <td className="truncate py-2 pr-3 text-ink">{page.title}</td>
      <td className="px-3 py-2 whitespace-nowrap text-ink-tertiary">{page.workspaceLabel}</td>
    </tr>
  );
}
