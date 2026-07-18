import { useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, X } from 'lucide-react';
import type { PageContent, RecentPage } from '../cairn-api';
import { pageSinks, sinkLabel } from '../lib/sinks';
import { useSettings } from '../settings-context';
import { JournalBlocks } from './worklog-content';
import { WorklogActions } from './worklog-actions';

type Props = { page: RecentPage; onClose: () => void; onExpand: () => void };

export function WorklogDrawer({ page, onClose, onExpand }: Props) {
  const { t } = useSettings();
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [content, setContent] = useState<PageContent | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [width, setWidth] = useState<number>(() => {
    const s = Number(localStorage.getItem('cairn:drawerWidth'));
    return s >= 360 && s <= 900 ? s : 460;
  });

  useEffect(() => {
    setShown(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    localStorage.setItem('cairn:drawerWidth', String(width));
  }, [width]);

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

  const resizeCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanup.current?.(), []);

  function requestClose() {
    setClosing(true);
    setTimeout(onClose, 200);
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const max = Math.min(900, Math.round(window.innerWidth * 0.92));
    const onMove = (ev: MouseEvent) =>
      setWidth(Math.min(max, Math.max(360, window.innerWidth - ev.clientX)));
    function cleanup() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizeCleanup.current = null;
    }
    function onUp() {
      cleanup();
    }
    resizeCleanup.current = cleanup; // 드래그 중 drawer 언마운트 시 리스너 정리(누수 방지)
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // 창 밖에서 버튼을 놓으면 mouseup 이 안 옴 — blur 로도 종료
    window.addEventListener('blur', onUp);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 [-webkit-app-region:no-drag]"
    >
      <div
        onMouseDown={requestClose}
        className={[
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          shown && !closing ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      {/* traffic light 높이만큼 창 드래그 가능한 strip */}
      <div className="absolute inset-x-0 top-0 h-10 [-webkit-app-region:drag]" />

      <div
        style={{ width: `${width}px` }}
        className={[
          'floating-panel absolute top-0 right-0 flex h-full max-w-[92vw] flex-col border-l border-hairline bg-surface-1 shadow-2xl shadow-black/40',
          closing ? 'drawer-out' : 'drawer-in',
        ].join(' ')}
      >
        <div
          onMouseDown={startResize}
          className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize hover:bg-hairline-tertiary [-webkit-app-region:no-drag]"
        />
        <div className="flex items-start gap-3 border-b border-hairline px-6 py-4 [-webkit-app-region:drag]">
          <div className="min-w-0 flex-1 cursor-text select-text [-webkit-app-region:no-drag]">
            <p className="truncate text-[15px] font-semibold text-ink">{page.title}</p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-ink-tertiary">
              {page.date ?? '—'} ·{' '}
              {pageSinks(page)
                .map((s) => sinkLabel(s, page, t('source.localDesc')))
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onExpand}
            title={t('drawer.expand')}
            aria-label={t('drawer.expand')}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
          >
            <Maximize2 size={14} strokeWidth={2} />
          </button>
          <WorklogActions
            page={page}
            content={content}
            onContentRestored={() => setReloadTick((n) => n + 1)}
          />
          <button
            type="button"
            onClick={requestClose}
            title={t('drawer.close')}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
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
            <JournalBlocks blocks={content.blocks} />
          )}
        </div>
      </div>
    </div>
  );
}
