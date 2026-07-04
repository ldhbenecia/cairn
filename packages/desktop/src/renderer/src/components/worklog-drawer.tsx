import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import hljs from 'highlight.js';
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  MoreHorizontal,
  X,
} from 'lucide-react';
import type { PageContent, RecentPage, RichSpan, SimpleBlock } from '../cairn-api';
import { sectionBullets } from '../lib/blocks';
import { blocksToMarkdown } from '../../../shared/markdown';
import { blocksToHtml } from '../../../shared/html';
import { useSettings } from '../settings-context';

type Props = { page: RecentPage; onClose: () => void };

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

  function savePdf() {
    if (!content || content.blocks.length === 0) return;
    const html = blocksToHtml(content.blocks, {
      title: page.title,
      date: page.date,
      workspace: page.workspaceLabel,
    });
    void window.cairn.exportPdf(`${page.date ?? 'cairn-worklog'}.pdf`, html);
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const closeMenu = (): void => {
    setMenuClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 130);
  };
  useEffect(() => {
    if (!menuOpen || menuClosing) return;
    const onDown = (): void => closeMenu();
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, menuClosing]);

  type Act = { key: string; icon: ReactNode; label: string; run: () => void };
  const actions: Act[] = [
    shareText && {
      key: 'share',
      icon: copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />,
      label: copied ? t('drawer.copied') : t('drawer.menuShare'),
      run: copyShare,
    },
    markdown && {
      key: 'md',
      icon: mdCopied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />,
      label: mdCopied ? t('drawer.copied') : t('drawer.menuCopyMd'),
      run: copyMarkdown,
    },
    markdown && {
      key: 'savemd',
      icon: <FileDown size={15} strokeWidth={2} />,
      label: t('drawer.menuSaveMd'),
      run: () => {
        saveMarkdown();
        closeMenu();
      },
    },
    markdown && {
      key: 'savepdf',
      icon: <FileText size={15} strokeWidth={2} />,
      label: t('drawer.menuSavePdf'),
      run: () => {
        savePdf();
        closeMenu();
      },
    },
    page.url && {
      key: 'notion',
      icon: <ExternalLink size={15} strokeWidth={2} />,
      label: t('drawer.menuNotion'),
      run: () => {
        void window.cairn.openExternal(page.url);
        closeMenu();
      },
    },
  ].filter(Boolean) as Act[];
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
          'absolute top-0 right-0 flex h-full max-w-[92vw] flex-col border-l border-hairline bg-surface-1 shadow-2xl shadow-black/40',
          closing ? 'drawer-out' : 'drawer-in',
        ].join(' ')}
      >
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
          {actions.length > 0 && (
            <div
              className="relative shrink-0 [-webkit-app-region:no-drag]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
                title={t('drawer.actions')}
                className={`flex size-7 items-center justify-center rounded-md transition-colors ${
                  menuOpen
                    ? 'bg-surface-2 text-ink'
                    : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <MoreHorizontal size={16} strokeWidth={2} />
              </button>
              {menuOpen && (
                <div
                  className={`${menuClosing ? 'popover-out' : 'popover-in'} glass-panel absolute right-0 top-9 z-30 w-48 rounded-lg border border-hairline bg-surface-1 p-1 shadow-xl shadow-black/40`}
                >
                  {actions.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={a.run}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <span className="flex w-4 shrink-0 justify-center text-ink-subtle">
                        {a.icon}
                      </span>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
            <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink">
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

// 발행 일지는 plain text 라 링크 annotation 이 없어, 평문 URL 을 직접 링크화
const URL_SPLIT = /(https?:\/\/[^\s)]+)/g;
function linkify(text: string): ReactNode[] {
  return text.split(URL_SPLIT).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <button
        key={i}
        type="button"
        onClick={() => void window.cairn.openExternal(part)}
        className="text-accent underline-offset-2 hover:underline"
      >
        {part}
      </button>
    ) : (
      <span key={i}>{part}</span>
    ),
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
            {s.code ? s.text : linkify(s.text)}
          </span>
        );
      })}
    </>
  );
}

// Notion 코드블록 언어명 → highlight.js 식별자 (불일치하는 것만)
const LANG_ALIAS: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  'objective-c': 'objectivec',
  'plain text': 'plaintext',
  shell: 'bash',
  html: 'xml',
  markup: 'xml',
  docker: 'dockerfile',
  'vb.net': 'vbnet',
  'visual basic': 'vbnet',
  webassembly: 'wasm',
  'llvm ir': 'llvm',
};

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const raw = (language ?? '').toLowerCase().trim();
  const mapped = LANG_ALIAS[raw] ?? raw;
  const lang = mapped && hljs.getLanguage(mapped) ? mapped : undefined;
  const html = lang
    ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    : hljs.highlightAuto(code).value;
  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      {language && mapped !== 'plaintext' && (
        <div className="border-b border-hairline bg-surface-3 px-3 py-1 font-mono text-[10px] text-ink-tertiary select-none">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto bg-surface-2 p-3 text-[12px] leading-relaxed">
        <code className="hljs font-mono" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
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
        <summary className="flex cursor-pointer list-none items-start gap-1 select-none marker:content-none hover:text-ink">
          <ChevronRight
            size={14}
            strokeWidth={2.25}
            className="mt-[3px] shrink-0 text-ink-tertiary transition-transform duration-200 group-open:rotate-90"
          />
          <span className="min-w-0">
            <Rich spans={b.rich} />
          </span>
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
