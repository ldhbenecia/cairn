import {
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  Circle,
  GitCommitHorizontal,
  GitPullRequest,
  HardDrive,
  ListTree,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunSession } from '../App';
import type {
  CoreMode,
  CoreRunOptions,
  RecentCategory,
  RecentListResult,
  RecentPage,
  RecentWarning,
  WorklogSink,
} from '../cairn-api';
import type { I18nKey } from '../i18n';
import { pageSinks, sinkLabel } from '../lib/sinks';
import { useSettings } from '../settings-context';
import { NotionMark, ObsidianMark } from './brand-icons';
import { Pagination } from './pagination';
import { PublishDialog } from './publish-dialog';
import type { WorklogFilter } from './sidebar';

type GroupBy = 'none' | 'category' | 'status';
type T = (key: I18nKey) => string;

type Props = {
  recent: RecentListResult | null;
  filter: WorklogFilter;
  sessions: Record<CoreMode, RunSession | null>;
  publishProgressSignal?: number;
  onConsumePublishSignal?: () => void;
  runningMode: CoreMode | null;
  onTrigger: (mode: CoreMode, options?: CoreRunOptions) => Promise<void>;
  onOpenPublished: (pageId: string, url: string | null) => void;
  onReload: () => Promise<unknown>;
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
  publishProgressSignal,
  onConsumePublishSignal,
  runningMode,
  onTrigger,
  onOpenPublished,
  onReload,
  onOpen,
  drawerOpen,
}: Props) {
  const { t } = useSettings();

  // 메인 프로세스는 경고를 코드로만 보냄 — 여기서 i18n 매핑. string 은 구버전 로컬 캐시 호환
  const warningText = (w: RecentWarning | string): string => {
    if (typeof w === 'string') return w;
    switch (w.code) {
      case 'no-workspaces':
        return t('list.warn.noWorkspaces');
      case 'token-missing':
        return t('list.warn.tokenMissing')
          .replace('{ws}', w.workspace)
          .replace('{env}', w.tokenEnv);
      case 'no-data-source':
        return t('list.warn.noDataSource').replace('{ws}', w.workspace);
      case 'fetch-failed':
        return t('list.warn.fetchFailed').replace('{ws}', w.workspace).replace('{kind}', w.kind);
    }
  };
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [desc, setDesc] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(-1);

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

  const navItems = useMemo(
    () => (groups ? groups.filter((g) => !collapsed.has(g.key)).flatMap((g) => g.rows) : visible),
    [groups, collapsed, visible],
  );
  const selectedId = sel >= 0 ? (navItems[sel]?.pageId ?? null) : null;

  useEffect(() => setSel(-1), [filter, query, desc, groupBy, current]);

  useEffect(() => {
    if (drawerOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // CommandPalette·StandupDialog 등 App 소유 오버레이 상태는 prop 으로 안 내려옴 —
      // 열린 오버레이는 전부 role="dialog"(radix) 또는 fixed inset-0 레이어로만 마운트되므로 DOM 으로 감지
      if (document.querySelector('[role="dialog"]')) return;
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
            <kbd className="shrink-0 rounded border border-hairline-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">
              ⌘K
            </kbd>
          </div>
          <span className="shrink-0 text-[12px] text-ink-tertiary">
            {filtered.length}
            {t('list.count')}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* Linear 상단 문법 — 텍스트 버튼 나열 대신 아이콘 전용, 현재 상태는 title 로 */}
            <button
              type="button"
              onClick={() => setGroupBy((g) => GROUP_NEXT[g])}
              title={t(GROUP_LABEL_KEY[groupBy])}
              aria-label={t(GROUP_LABEL_KEY[groupBy])}
              className={[
                'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                groupBy === 'none'
                  ? 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                  : 'bg-surface-3 text-ink',
              ].join(' ')}
            >
              <ListTree size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setDesc((v) => !v)}
              title={desc ? t('list.sort.desc') : t('list.sort.asc')}
              aria-label={desc ? t('list.sort.desc') : t('list.sort.asc')}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ArrowDownUp size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              title={t('list.reload')}
              aria-label={t('list.reload')}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <RefreshCw size={14} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="mx-1 h-4 w-px shrink-0 bg-hairline" />
            <PublishDialog
              sessions={sessions}
              runningMode={runningMode}
              onTrigger={onTrigger}
              onOpenPublished={onOpenPublished}
              openProgressSignal={publishProgressSignal}
              onConsumeSignal={onConsumePublishSignal}
            />
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
            <div className="rounded-lg border border-hairline py-16 text-center text-[12px] text-ink-tertiary">
              {pages.length === 0 ? t('list.empty') : t('list.emptyFiltered')}
            </div>
          ) : groups ? (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.key)}
                    className="mb-1 flex w-full items-center gap-1.5 px-1 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase transition-colors hover:text-ink"
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
                    <div className="divide-y divide-hairline">
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
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="divide-y divide-hairline"
            >
              {visible.map((p) => (
                <PageRow
                  key={p.pageId}
                  page={p}
                  t={t}
                  onOpen={onOpen}
                  selected={p.pageId === selectedId}
                />
              ))}
            </motion.div>
          )}

          {recent && recent.warnings.length > 0 && (
            <div className="mt-3 rounded-md border border-hairline bg-surface-1 p-3 text-[12px] text-ink-tertiary">
              <p className="mb-1 font-medium text-ink-subtle">{t('list.warnings')}</p>
              {recent.warnings.map((w, i) => (
                <p key={i} className="font-mono">
                  {warningText(w)}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {groupBy === 'none' && pageCount > 1 && (
        <div className="border-t border-hairline px-4 py-3.5">
          <Pagination
            totalPages={pageCount}
            currentPage={current + 1}
            onPageChange={(p) => setPage(p - 1)}
            maxVisiblePages={9}
          />
        </div>
      )}
    </section>
  );
}

const CATEGORY_DOT: Record<RecentCategory, string> = {
  daily: 'dot-daily',
  weekly: 'dot-weekly',
  monthly: 'dot-monthly',
  yearly: 'dot-yearly',
};

// 날짜 프리픽스 제목("2026-07-17 작업 일지")은 날짜가 행 제목 — "작업 일지" 같은 카테고리 접미는
// 모든 행에 반복되므로 제거(카테고리는 도트+aria 가 표현). 커스텀 제목('2026 roadmap' 등)은 그대로
const TITLE_DATE_RE: Record<RecentCategory, RegExp> = {
  daily: /^(\d{4}-\d{2}-\d{2})\s+(.+)$/,
  weekly: /^(\d{4}-W\d{2})\s+(.+)$/,
  monthly: /^(\d{4}-\d{2})\s+(.+)$/,
  yearly: /^(\d{4})\s+(.+)$/,
};

function rowTitle(page: RecentPage): string {
  const m = TITLE_DATE_RE[page.category].exec(page.title);
  return m ? m[1]! : page.title;
}

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
  const counts =
    page.pr !== null || page.commit !== null ? { gh: page.pr ?? 0, git: page.commit ?? 0 } : null;
  const title = rowTitle(page);
  const status = page.status ?? t('list.statusNone');
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
        'group flex h-10 w-full items-center gap-3 px-3 text-left text-[13px] transition-[background-color]',
        selected ? 'bg-surface-3 ring-1 ring-hairline-strong ring-inset' : 'hover:bg-surface-2',
      ].join(' ')}
    >
      <span className="flex shrink-0 items-center" role="img" aria-label={status} title={status}>
        {page.status === 'final' ? (
          <CheckCircle2 size={14} strokeWidth={2} className="text-success" />
        ) : (
          <Circle size={14} strokeWidth={2} className="text-ink-tertiary" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink">{title}</span>
      {counts && (
        <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
          <span
            className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] text-ink-tertiary"
            title="GitHub PR"
          >
            <GitPullRequest size={11} strokeWidth={2} />
            {counts.gh}
          </span>
          <span
            className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] text-ink-tertiary"
            title="commits"
          >
            <GitCommitHorizontal size={11} strokeWidth={2} />
            {counts.git}
          </span>
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-muted">
        <span
          className={['size-1.5 rounded-full', CATEGORY_DOT[page.category]].join(' ')}
          aria-hidden="true"
        />
        {t(catKey(page.category))}
      </span>
      <SinkStack page={page} t={t} />
      {/* 날짜 프리픽스 제목은 날짜가 곧 행 제목 — 커스텀 제목일 때만 우측 mono 날짜로 보충 (이중 표기 방지) */}
      {title === page.title && page.date && page.date !== title && (
        <span className="shrink-0 font-mono text-[11px] whitespace-nowrap text-ink-tertiary tabular-nums">
          {page.date}
        </span>
      )}
    </button>
  );
}

function SinkStack({ page, t }: { page: RecentPage; t: T }) {
  const sinks = pageSinks(page);
  return (
    <span
      className="hidden w-12 shrink-0 items-center justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:flex"
      title={sinks.map((s) => sinkLabel(s, page, t('source.localDesc'))).join(' · ')}
    >
      {sinks.map((s) => (
        <span
          key={s}
          className={[
            'flex size-3.5 shrink-0 items-center justify-center rounded-full ring-2 ring-canvas first:ml-0 -ml-1.5',
            SINK_TILE[s],
          ].join(' ')}
        >
          {s === 'journal' ? (
            <HardDrive size={9} strokeWidth={2.25} />
          ) : s === 'notion' ? (
            <NotionMark size={8} />
          ) : (
            <ObsidianMark size={9} />
          )}
        </span>
      ))}
    </span>
  );
}

const SINK_TILE: Record<WorklogSink, string> = {
  journal: 'bg-surface-3 text-ink-muted',
  notion: 'bg-white text-black',
  obsidian: 'bg-surface-3',
};
