import {
  ArrowDownUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitCommitHorizontal,
  GitPullRequest,
  ListTree,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunSession } from '../App';
import type {
  CoreMode,
  CoreRunOptions,
  RecentCategory,
  RecentListResult,
  RecentPage,
} from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';
import { PublishDialog } from './publish-dialog';
import type { WorklogFilter } from './sidebar';

type GroupBy = 'none' | 'category' | 'status';
type T = (key: I18nKey) => string;

type Props = {
  recent: RecentListResult | null;
  filter: WorklogFilter;
  sessions: Record<CoreMode, RunSession | null>;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
  onReload: () => Promise<void>;
  onOpen: (page: RecentPage) => void;
  drawerOpen: boolean;
};

const PER_PAGE = 20;

const GROUP_NEXT: Record<GroupBy, GroupBy> = {
  none: 'category',
  category: 'status',
  status: 'none',
};
const GROUP_LABEL_KEY: Record<GroupBy, I18nKey> = {
  none: 'list.group.none',
  category: 'list.group.category',
  status: 'list.group.status',
};

const catKey = (c: RecentCategory): I18nKey => `nav.${c}`;

export function WorklogList({
  recent,
  filter,
  sessions,
  runningMode,
  onTrigger,
  onReload,
  onOpen,
  drawerOpen,
}: Props) {
  const { t } = useSettings();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [desc, setDesc] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(-1); // 키보드 내비게이션 선택 인덱스

  const pages = recent?.pages ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = pages.filter((p) => {
      if (filter !== 'all' && p.category !== filter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const cmp = (a.date ?? '').localeCompare(b.date ?? '');
      return desc ? -cmp : cmp;
    });
    return rows;
  }, [pages, filter, query, desc]);

  const groups = useMemo(() => groupRows(filtered, groupBy, t), [filtered, groupBy, t]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  useEffect(() => {
    setPage(0);
  }, [filter, query, desc]);
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  // 화면에 실제로 그려지는 행들(그룹/페이지 반영) — 키보드 내비 대상
  const navItems = useMemo(
    () => (groups ? groups.filter((g) => !collapsed.has(g.key)).flatMap((g) => g.rows) : visible),
    [groups, collapsed, visible],
  );
  const selectedId = sel >= 0 ? (navItems[sel]?.pageId ?? null) : null;

  useEffect(() => setSel(-1), [filter, query, desc, groupBy, current]);

  useEffect(() => {
    if (drawerOpen) return; // 드로어 열렸을 땐 리스트 내비 비활성
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((i) => Math.min(i + 1, navItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const p = navItems[sel];
        if (p) onOpen(p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, navItems, sel, onOpen]);

  async function reload() {
    setLoading(true);
    try {
      await onReload();
    } finally {
      setLoading(false);
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-20 shrink-0 [-webkit-app-region:drag]" />
      <header className="shrink-0 pb-4">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-6">
          <div className="flex w-56 min-w-0 shrink items-center gap-2 rounded-md border border-hairline bg-surface-1 px-2.5 py-1.5">
            <Search size={13} strokeWidth={2} className="shrink-0 text-ink-tertiary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('list.search')}
              className="w-full min-w-0 bg-transparent text-[13px] text-ink placeholder:text-ink-tertiary focus:outline-none"
            />
          </div>
          <span className="shrink-0 text-[12px] text-ink-tertiary">
            {filtered.length}
            {t('list.count')}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setGroupBy((g) => GROUP_NEXT[g])}
              className={[
                'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] whitespace-nowrap transition-colors',
                groupBy === 'none'
                  ? 'border-hairline text-ink-muted hover:bg-surface-2 hover:text-ink'
                  : 'border-accent/50 bg-accent/15 text-ink',
              ].join(' ')}
            >
              <ListTree size={12} strokeWidth={2} />
              {t(GROUP_LABEL_KEY[groupBy])}
            </button>
            <button
              type="button"
              onClick={() => setDesc((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-2 py-1.5 text-[12px] whitespace-nowrap text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ArrowDownUp size={12} strokeWidth={2} />
              {desc ? t('list.sort.desc') : t('list.sort.asc')}
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-2 py-1.5 text-[12px] whitespace-nowrap text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <RefreshCw size={12} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
              {t('list.reload')}
            </button>
            <PublishDialog sessions={sessions} runningMode={runningMode} onTrigger={onTrigger} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div key={filter} className="panel-enter mx-auto w-full max-w-5xl px-6 pb-6">
          {!recent ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-ink-tertiary">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              {t('list.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-hairline bg-surface-1 py-16 text-center text-[12px] text-ink-tertiary">
              {pages.length === 0 ? t('list.empty') : t('list.emptyFiltered')}
            </div>
          ) : groups ? (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.key)}
                    className="mb-1.5 flex w-full items-center gap-1.5 px-1 text-[12px] font-medium text-ink-subtle hover:text-ink"
                  >
                    <ChevronDown
                      size={13}
                      strokeWidth={2.25}
                      className={[
                        'transition-transform',
                        collapsed.has(g.key) ? '-rotate-90' : '',
                      ].join(' ')}
                    />
                    {g.label}
                    <span className="font-mono text-ink-tertiary">{g.rows.length}</span>
                  </button>
                  {!collapsed.has(g.key) && (
                    <div className="overflow-hidden rounded-lg border border-hairline bg-surface-1">
                      {g.rows.map((p) => (
                        <PageRow
                          key={p.pageId}
                          page={p}
                          t={t}
                          onOpen={onOpen}
                          selected={p.pageId === selectedId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-hairline bg-surface-1">
              {visible.map((p) => (
                <PageRow
                  key={p.pageId}
                  page={p}
                  t={t}
                  onOpen={onOpen}
                  selected={p.pageId === selectedId}
                />
              ))}
            </div>
          )}

          {recent && recent.warnings.length > 0 && (
            <div className="mt-3 rounded-md border border-hairline bg-surface-1 p-3 text-[12px] text-ink-tertiary">
              <p className="mb-1 font-medium text-ink-subtle">{t('list.warnings')}</p>
              {recent.warnings.map((w, i) => (
                <p key={i} className="font-mono">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {groupBy === 'none' && pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-hairline py-2.5 text-[12px] text-ink-subtle">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="flex size-6 items-center justify-center rounded-md hover:bg-surface-2 disabled:opacity-30"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <span className="font-mono">
            {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
            className="flex size-6 items-center justify-center rounded-md hover:bg-surface-2 disabled:opacity-30"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </section>
  );
}

// 칩 색은 테마별로 다르게 — styles.css 의 .chip-* (다크 기본 + 라이트 대비 보정)
const CATEGORY_STYLE: Record<RecentCategory, string> = {
  daily: 'chip-daily',
  weekly: 'chip-weekly',
  monthly: 'chip-monthly',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'chip-draft',
  final: 'chip-final',
};

type Group = { key: string; label: string; rows: RecentPage[] };

function groupRows(rows: RecentPage[], groupBy: GroupBy, t: T): Group[] | null {
  if (groupBy === 'none') return null;
  const order =
    groupBy === 'category' ? ['daily', 'weekly', 'monthly'] : ['draft', 'final', '__none'];
  const labelOf = (k: string): string =>
    groupBy === 'category'
      ? t(catKey(k as RecentCategory))
      : k === '__none'
        ? t('list.statusNone')
        : k;
  const map = new Map<string, RecentPage[]>();
  for (const p of rows) {
    const k = groupBy === 'category' ? p.category : (p.status ?? '__none');
    const bucket = map.get(k);
    if (bucket) bucket.push(p);
    else map.set(k, [p]);
  }
  const keys = [
    ...order.filter((k) => map.has(k)),
    ...[...map.keys()].filter((k) => !order.includes(k)),
  ];
  return keys.map((k) => ({ key: k, label: labelOf(k), rows: map.get(k) as RecentPage[] }));
}

// "gh:6 / git:43 / notion:0"(과거 포맷) → { gh, git }. notion 은 무시.
function parseSourceCounts(s: string): { gh: number; git: number } | null {
  const gh = Number(/gh:(\d+)/.exec(s)?.[1]);
  const git = Number(/git:(\d+)/.exec(s)?.[1]);
  if (!Number.isFinite(gh) && !Number.isFinite(git)) return null;
  return { gh: Number.isFinite(gh) ? gh : 0, git: Number.isFinite(git) ? git : 0 };
}

function PageRow({
  page,
  t,
  onOpen,
  selected,
}: {
  page: RecentPage;
  t: T;
  onOpen: (p: RecentPage) => void;
  selected: boolean;
}) {
  const counts = page.sourceCounts ? parseSourceCounts(page.sourceCounts) : null;
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(page)}
      className={[
        'flex w-full items-center gap-4 border-b border-hairline px-4 py-3.5 text-left text-[13px] transition-[background-color] last:border-b-0',
        selected ? 'bg-surface-2 ring-1 ring-accent/50 ring-inset' : 'hover:bg-surface-2',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1 truncate text-ink">{page.title}</span>
      {counts && (
        <span className="hidden shrink-0 items-center gap-2.5 font-mono text-[11px] text-ink-tertiary lg:flex">
          <span className="flex items-center gap-1" title="GitHub PR">
            <GitPullRequest size={11} strokeWidth={2} />
            {counts.gh}
          </span>
          <span className="flex items-center gap-1" title="commits">
            <GitCommitHorizontal size={11} strokeWidth={2} />
            {counts.git}
          </span>
        </span>
      )}
      <span
        className={[
          'shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium',
          CATEGORY_STYLE[page.category],
        ].join(' ')}
      >
        {t(catKey(page.category))}
      </span>
      <span className="w-22 shrink-0 text-right font-mono text-[12px] text-ink-muted">
        {page.date ?? '—'}
      </span>
      {page.status && (
        <span
          className={[
            'w-12 shrink-0 rounded-md border px-2 py-0.5 text-center text-[11px]',
            STATUS_STYLE[page.status] ?? 'border-hairline text-ink-tertiary',
          ].join(' ')}
        >
          {page.status}
        </span>
      )}
      <span className="hidden w-16 shrink-0 text-right text-[12px] text-ink-subtle sm:inline">
        {page.workspaceLabel}
      </span>
    </button>
  );
}
