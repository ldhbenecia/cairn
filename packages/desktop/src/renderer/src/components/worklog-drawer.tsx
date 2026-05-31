import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import type { PageContent, RecentPage, SimpleBlock } from '../cairn-api';
import { useSettings } from '../settings-context';

type Props = { page: RecentPage; onClose: () => void };

export function WorklogDrawer({ page, onClose }: Props) {
  const { t } = useSettings();
  const [show, setShow] = useState(false);
  const [content, setContent] = useState<PageContent | null>(null);

  useEffect(() => {
    setShow(true);
  }, []);

  useEffect(() => {
    let alive = true;
    setContent(null);
    void window.cairn.pageContent(page.pageId, page.workspaceLabel).then((c) => {
      if (alive) setContent(c);
    });
    return () => {
      alive = false;
    };
  }, [page.pageId, page.workspaceLabel]);

  function requestClose() {
    setShow(false);
    setTimeout(onClose, 200);
  }

  return (
    <div className="fixed inset-0 z-50 [-webkit-app-region:no-drag]">
      <div
        onMouseDown={requestClose}
        className={[
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <div
        className={[
          'absolute top-0 right-0 flex h-full w-[460px] max-w-[88vw] flex-col border-l border-hairline bg-surface-1 shadow-2xl shadow-black/40 transition-transform duration-200 ease-out',
          show ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{page.title}</p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-tertiary">
              {page.date ?? '—'} · {page.workspaceLabel}
            </p>
          </div>
          {page.url && (
            <button
              type="button"
              onClick={() => void window.cairn.openExternal(page.url)}
              title={t('publish.openNotion')}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
            >
              <ExternalLink size={15} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={requestClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
          {!content ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-ink-tertiary">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              노션에서 불러오는 중...
            </div>
          ) : content.warning ? (
            <p className="text-[13px] text-ink-tertiary">{content.warning}</p>
          ) : content.blocks.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">내용 없음</p>
          ) : (
            <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink-muted">
              {content.blocks.map((b) => (
                <Block key={b.id} b={b} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ b }: { b: SimpleBlock }) {
  switch (b.type) {
    case 'heading_1':
      return <h2 className="mt-3 text-[17px] font-semibold text-ink">{b.text}</h2>;
    case 'heading_2':
      return <h3 className="mt-2.5 text-[15px] font-semibold text-ink">{b.text}</h3>;
    case 'heading_3':
      return <h4 className="mt-2 text-[14px] font-semibold text-ink">{b.text}</h4>;
    case 'bulleted_list_item':
      return (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">•</span>
          <span>{b.text}</span>
        </p>
      );
    case 'numbered_list_item':
      return (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">–</span>
          <span>{b.text}</span>
        </p>
      );
    case 'to_do':
      return (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">{b.checked ? '☑' : '☐'}</span>
          <span className={b.checked ? 'line-through opacity-60' : ''}>{b.text}</span>
        </p>
      );
    case 'quote':
      return <p className="border-l-2 border-hairline-strong pl-3 text-ink-subtle">{b.text}</p>;
    case 'callout':
      return <p className="rounded-md border border-hairline bg-surface-2 px-3 py-2">{b.text}</p>;
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-md border border-hairline bg-surface-2 p-3 font-mono text-[12px] text-ink-muted">
          {b.text}
        </pre>
      );
    case 'divider':
      return <hr className="my-2 border-hairline" />;
    default:
      return b.text ? <p>{b.text}</p> : <div className="h-1.5" />;
  }
}
