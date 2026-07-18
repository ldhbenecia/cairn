import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CircleDashed,
  GitCommitHorizontal,
  GitPullRequest,
  HardDrive,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import type { PageContent, RecentPage } from '../cairn-api';
import { pageSinks, sinkLabel } from '../lib/sinks';
import { useSettings } from '../settings-context';
import { NotionMark, ObsidianMark } from './brand-icons';
import { JournalBlocks } from './worklog-content';
import { WorklogActions } from './worklog-actions';

// 일지 전체 화면 상세 — 메인 영역을 통째로 차지 (Linear 이슈 상세: 중앙 본문 + 우측 meta 열)

export function WorklogDetailView({ page, onBack }: { page: RecentPage; onBack: () => void }) {
  const { t } = useSettings();
  const [content, setContent] = useState<PageContent | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setContent(null);
    // 조회 실패 시 무한 로딩 방지 — warning 경로로 오류 문구 표시 (t 는 언어 변경 시에만 재생성)
    void window.cairn.pageContent(page.pageId, page.workspaceLabel).then(
      (c) => {
        if (alive) setContent(c);
      },
      () => {
        if (alive) setContent({ blocks: [], warning: t('drawer.loadError') });
      },
    );
    return () => {
      alive = false;
    };
  }, [page.pageId, page.workspaceLabel, reloadTick, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // 스냅샷 등 오버레이가 떠 있으면 그쪽 ESC 가 우선 (worklog-list 와 같은 DOM 감지)
      if (document.querySelector('[role="dialog"]')) return;
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const sinks = pageSinks(page);

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-20 shrink-0 [-webkit-app-region:drag]" />
      <header className="shrink-0 pb-3">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-6">
          <button
            type="button"
            onClick={onBack}
            title={t('detail.back')}
            aria-label={t('detail.back')}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>
          <span className="min-w-0 truncate font-mono text-[12px] text-ink-tertiary">
            {page.date ?? '—'}
          </span>
          <div className="ml-auto [-webkit-app-region:no-drag]">
            <WorklogActions
              page={page}
              content={content}
              onContentRestored={() => setReloadTick((n) => n + 1)}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="panel-enter mx-auto flex w-full max-w-5xl items-start gap-10 px-6 pb-12">
          <article className="min-w-0 max-w-3xl flex-1">
            <h1 className="cursor-text text-[20px] leading-snug font-semibold tracking-[-0.3px] text-ink select-text">
              {page.title}
            </h1>
            <div className="mt-6">
              {!content ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-ink-tertiary">
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  {t('drawer.loading')}
                </div>
              ) : content.warning ? (
                <p className="text-[13px] text-ink-tertiary">{content.warning}</p>
              ) : content.blocks.length === 0 ? (
                <p className="text-[13px] text-ink-tertiary">{t('drawer.empty')}</p>
              ) : (
                <JournalBlocks
                  blocks={content.blocks}
                  className="journal-content flex flex-col gap-2 text-[13.5px] leading-[1.7] text-ink"
                />
              )}
            </div>
          </article>

          <aside className="sticky top-0 hidden w-56 shrink-0 flex-col border-l border-hairline pl-6 lg:flex">
            <p className="pb-2 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
              {t('detail.properties')}
            </p>
            <MetaRow icon={CalendarDays}>
              <span className="font-mono tabular-nums">{page.date ?? '—'}</span>
            </MetaRow>
            <MetaRow dotClass={`dot-${page.category}`}>{t(`nav.${page.category}`)}</MetaRow>
            {page.pr !== null && (
              <MetaRow icon={GitPullRequest}>
                PR <span className="font-mono tabular-nums">{page.pr}</span>
              </MetaRow>
            )}
            {page.commit !== null && (
              <MetaRow icon={GitCommitHorizontal}>
                {t('achv.commits')} <span className="font-mono tabular-nums">{page.commit}</span>
              </MetaRow>
            )}
            {page.status && (
              <MetaRow icon={CircleDashed}>
                <span className="truncate">{page.status}</span>
              </MetaRow>
            )}
            <div className="my-2 h-px bg-hairline" />
            {sinks.map((s) => {
              const label = sinkLabel(s, page, t('source.localDesc'));
              const icon =
                s === 'journal' ? (
                  <HardDrive size={14} strokeWidth={1.75} />
                ) : s === 'notion' ? (
                  <NotionMark size={12} />
                ) : (
                  <ObsidianMark size={13} />
                );
              if (s === 'notion' && page.url) {
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void window.cairn.openExternal(page.url)}
                    className="flex h-7 items-center gap-2.5 text-left text-[13px] text-ink-muted transition-colors hover:text-ink"
                  >
                    <span className="flex w-4 shrink-0 justify-center text-ink-tertiary">
                      {icon}
                    </span>
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                );
              }
              return (
                <MetaRow key={s} iconNode={icon}>
                  <span className="min-w-0 truncate">{label}</span>
                </MetaRow>
              );
            })}
          </aside>
        </div>
      </div>
    </section>
  );
}

function MetaRow({
  icon: Icon,
  iconNode,
  dotClass,
  children,
}: {
  icon?: LucideIcon;
  iconNode?: React.ReactNode;
  dotClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-7 items-center gap-2.5 text-[13px] text-ink-muted">
      <span className="flex w-4 shrink-0 items-center justify-center text-ink-tertiary">
        {Icon ? (
          <Icon size={14} strokeWidth={1.75} />
        ) : dotClass ? (
          <span className={`size-1.5 rounded-full ${dotClass}`} />
        ) : (
          iconNode
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">{children}</span>
    </div>
  );
}
