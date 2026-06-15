import { useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { Check, Copy, ExternalLink, FileDown, Loader2, X } from 'lucide-react';
import type { PageContent, RecentPage, RichSpan, SimpleBlock } from '../cairn-api';
import { sectionBullets } from '../lib/blocks';
import { blocksToMarkdown } from '../lib/markdown';
import { useSettings } from '../settings-context';
import 'highlight.js/styles/github-dark.css';

type Props = { page: RecentPage; onClose: () => void };

// 'Share' 헤딩 아래 bullet 들을 스탠드업 복붙용 plain text 로 (없으면 null)
function extractShareText(blocks: SimpleBlock[]): string | null {
  const lines = sectionBullets(blocks, 'share');
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join('\n') : null;
}

export function WorklogDrawer({ page, onClose }: Props) {
  const { t } = useSettings();
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);
  const [content, setContent] = useState<PageContent | null>(null);
  const shareText = useMemo(() => (content ? extractShareText(content.blocks) : null), [content]);
  const markdown = useMemo(
    () =>
      content && content.blocks.length > 0
        ? blocksToMarkdown(content.blocks, {
            title: page.title,
            date: page.date,
            workspace: page.workspaceLabel,
          })
        : null,
    [content, page.title, page.date, page.workspaceLabel],
  );

  function copyShare() {
    if (!shareText) return;
    void navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function copyMarkdown() {
    if (!markdown) return;
    void navigator.clipboard.writeText(markdown).then(() => {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 1500);
    });
  }

  function saveMarkdown() {
    if (!markdown) return;
    void window.cairn.exportMarkdown(`${page.date ?? 'cairn-worklog'}.md`, markdown);
  }
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
    void window.cairn.pageContent(page.pageId, page.workspaceLabel).then((c) => {
      if (alive) setContent(c);
    });
    return () => {
      alive = false;
    };
  }, [page.pageId, page.workspaceLabel]);

  function requestClose() {
    setClosing(true);
    setTimeout(onClose, 200);
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const max = Math.min(900, Math.round(window.innerWidth * 0.92));
    const onMove = (ev: MouseEvent) =>
      setWidth(Math.min(max, Math.max(360, window.innerWidth - ev.clientX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div className="fixed inset-0 z-50 [-webkit-app-region:no-drag]">
      <div
        onMouseDown={requestClose}
        className={[
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          shown && !closing ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      {/* 상단 strip — traffic light 높이만큼 창 드래그 가능 (백드롭보다 위, 패널보다 아래) */}
      <div className="absolute inset-x-0 top-0 h-10 [-webkit-app-region:drag]" />

      <div
        style={{ width: `${width}px` }}
        className={[
          'glass-panel absolute top-0 right-0 flex h-full max-w-[92vw] flex-col border-l border-hairline bg-surface-1 shadow-2xl shadow-black/40',
          closing ? 'drawer-out' : 'drawer-in',
        ].join(' ')}
      >
        {/* 좌측 엣지 리사이즈 핸들 */}
        <div
          onMouseDown={startResize}
          className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize hover:bg-accent/40 [-webkit-app-region:no-drag]"
        />
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-4 [-webkit-app-region:drag]">
          <div className="min-w-0 flex-1 cursor-text select-text [-webkit-app-region:no-drag]">
            <p className="truncate text-[15px] font-semibold text-ink">{page.title}</p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-tertiary">
              {page.date ?? '—'} · {page.workspaceLabel}
            </p>
          </div>
          {shareText && (
            <button
              type="button"
              onClick={copyShare}
              title={t('drawer.copyShare')}
              className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors [-webkit-app-region:no-drag] ${
                copied
                  ? 'bg-success/15 text-success'
                  : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
              {copied ? t('drawer.copied') : t('drawer.share')}
            </button>
          )}
          {markdown && (
            <>
              <button
                type="button"
                onClick={copyMarkdown}
                title={t('drawer.copyMd')}
                className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors [-webkit-app-region:no-drag] ${
                  mdCopied
                    ? 'bg-success/15 text-success'
                    : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {mdCopied ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : (
                  <Copy size={14} strokeWidth={2} />
                )}
                {mdCopied ? t('drawer.copied') : 'MD'}
              </button>
              <button
                type="button"
                onClick={saveMarkdown}
                title={t('drawer.saveMd')}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
              >
                <FileDown size={15} strokeWidth={2} />
              </button>
            </>
          )}
          {page.url && (
            <button
              type="button"
              onClick={() => void window.cairn.openExternal(page.url)}
              title={t('publish.openNotion')}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
            >
              <ExternalLink size={15} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={requestClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink [-webkit-app-region:no-drag]"
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

function Rich({ spans }: { spans: RichSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        const cls = [
          s.bold ? 'font-semibold text-ink' : '',
          s.italic ? 'italic' : '',
          s.strike ? 'line-through opacity-70' : '',
          s.code ? 'rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px]' : '',
        ].join(' ');
        if (s.href) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => s.href && void window.cairn.openExternal(s.href)}
              className={`${cls} text-accent hover:underline`}
            >
              {s.text}
            </button>
          );
        }
        return (
          <span key={i} className={cls || undefined}>
            {s.text}
          </span>
        );
      })}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const lang = language && hljs.getLanguage(language) ? language : undefined;
  const html = lang
    ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    : hljs.highlightAuto(code).value;
  return (
    <pre className="overflow-x-auto rounded-md border border-hairline text-[12px] leading-relaxed">
      <code className="hljs font-mono" dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

function Children({ blocks }: { blocks: SimpleBlock[] }) {
  return (
    <div className="ml-4 flex flex-col gap-1.5 border-l border-hairline pl-3">
      {blocks.map((c) => (
        <Block key={c.id} b={c} />
      ))}
    </div>
  );
}

function Block({ b }: { b: SimpleBlock }) {
  const kids = b.children && b.children.length > 0 ? <Children blocks={b.children} /> : null;

  if (b.type === 'toggle') {
    return (
      <details className="group">
        <summary className="list-none marker:content-none">
          <span className="text-ink-tertiary">▸ </span>
          <Rich spans={b.rich} />
        </summary>
        {kids && <div className="mt-1.5">{kids}</div>}
      </details>
    );
  }

  let body: React.ReactNode;
  switch (b.type) {
    case 'heading_1':
      body = (
        <h2 className="mt-3 text-[17px] font-semibold text-ink">
          <Rich spans={b.rich} />
        </h2>
      );
      break;
    case 'heading_2':
      body = (
        <h3 className="mt-2.5 text-[15px] font-semibold text-ink">
          <Rich spans={b.rich} />
        </h3>
      );
      break;
    case 'heading_3':
      body = (
        <h4 className="mt-2 text-[14px] font-semibold text-ink">
          <Rich spans={b.rich} />
        </h4>
      );
      break;
    case 'bulleted_list_item':
      body = (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">•</span>
          <span>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'numbered_list_item':
      body = (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">–</span>
          <span>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'to_do':
      body = (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">{b.checked ? '☑' : '☐'}</span>
          <span className={b.checked ? 'line-through opacity-60' : ''}>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'quote':
      body = (
        <p className="border-l-2 border-hairline-strong pl-3 text-ink-subtle">
          <Rich spans={b.rich} />
        </p>
      );
      break;
    case 'callout':
      body = (
        <p className="flex gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2">
          {b.iconUrl ? (
            <img src={b.iconUrl} alt="" className="mt-0.5 h-4 w-4 shrink-0 rounded-sm" />
          ) : (
            b.icon && <span className="shrink-0">{b.icon}</span>
          )}
          <span>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'code':
      body = <CodeBlock code={b.rich.map((s) => s.text).join('')} language={b.language} />;
      break;
    case 'divider':
      body = <hr className="my-2 border-hairline" />;
      break;
    default:
      body =
        b.rich.length > 0 ? (
          <p>
            <Rich spans={b.rich} />
          </p>
        ) : (
          <div className="h-1.5" />
        );
  }

  return (
    <>
      {body}
      {kids}
    </>
  );
}
