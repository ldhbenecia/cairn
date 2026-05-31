import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { RecentCategory, RecentListResult, RecentPage } from '../cairn-api';

type Props = {
  recent: RecentListResult | null;
  onReload: () => Promise<void>;
};

export function RecentTable({ recent, onReload }: Props) {
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
    <div className="mt-10">
      <div className="mb-2 flex items-center gap-2.5">
        <h3 className="text-[12px] font-medium uppercase tracking-wider text-ink-tertiary">
          최근 발행
        </h3>
        {recent && (
          <span className="text-[12px] text-ink-tertiary">
            {recent.pages.length > 0 ? `${recent.pages.length}개` : '없음'}
          </span>
        )}
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
        <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-ink-tertiary">
          <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          노션 DB 조회 중...
        </div>
      ) : recent.pages.length > 0 ? (
        <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface-1">
          {recent.pages.map((p) => (
            <PageRow key={p.pageId} page={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-hairline bg-surface-1 py-10 text-center text-[12px] text-ink-tertiary">
          발행된 일지 없음
        </div>
      )}

      {recent && recent.warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-hairline bg-surface-1 p-3 text-[12px] text-ink-tertiary">
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

const CATEGORY_STYLE: Record<RecentCategory, string> = {
  daily: 'border-accent/40 bg-accent/15 text-[#9db3cc]',
  weekly: 'border-[#3a5a9a]/40 bg-[#3a5a9a]/15 text-[#8fb0e8]',
  monthly: 'border-[#6b4a9a]/40 bg-[#6b4a9a]/15 text-[#b89ae0]',
};

const CATEGORY_LABEL: Record<RecentCategory, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'border-[#7a5c3a]/40 bg-[#7a5c3a]/15 text-[#d4a574]',
  final: 'border-success/40 bg-success/15 text-success',
};

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={['shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium', className].join(
        ' ',
      )}
    >
      {children}
    </span>
  );
}

function PageRow({ page }: { page: RecentPage }) {
  return (
    <button
      type="button"
      onClick={() => page.url && void window.cairn.openExternal(page.url)}
      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2"
    >
      <Chip className={CATEGORY_STYLE[page.category]}>{CATEGORY_LABEL[page.category]}</Chip>
      <span className="w-24 shrink-0 font-mono whitespace-nowrap text-ink-muted">
        {page.date ?? '—'}
      </span>
      <span className="flex-1 truncate text-ink">{page.title}</span>
      {page.sourceCounts && (
        <span className="shrink-0 font-mono text-[11px] text-ink-tertiary">
          {page.sourceCounts}
        </span>
      )}
      {page.status && (
        <Chip className={STATUS_STYLE[page.status] ?? 'border-hairline text-ink-tertiary'}>
          {page.status}
        </Chip>
      )}
      <span className="w-16 shrink-0 text-right text-[12px] text-ink-tertiary">
        {page.workspaceLabel}
      </span>
    </button>
  );
}
