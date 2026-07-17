import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  History,
  MoreHorizontal,
} from 'lucide-react';
import type { PageContent, RecentPage, SimpleBlock } from '../cairn-api';
import { sectionBullets } from '../lib/blocks';
import { pageSinks } from '../lib/sinks';
import { blocksToMarkdown } from '../../../shared/markdown';
import { blocksToHtml } from '../../../shared/html';
import { useSettings } from '../settings-context';
import { SnapshotDialog } from './snapshot-dialog';

// 드로어·전체 화면 상세가 공유하는 내보내기·공유 메뉴 (스냅샷 다이얼로그 포함)

function extractShareText(blocks: SimpleBlock[]): string | null {
  const lines = sectionBullets(blocks, 'share');
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join('\n') : null;
}

export function WorklogActions({
  page,
  content,
  onContentRestored,
}: {
  page: RecentPage;
  content: PageContent | null;
  onContentRestored: () => void;
}) {
  const { t } = useSettings();
  const [copied, setCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);

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
    pageSinks(page).includes('journal') && {
      key: 'history',
      icon: <History size={15} strokeWidth={2} />,
      label: t('drawer.menuHistory'),
      run: () => {
        setSnapOpen(true);
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

  if (actions.length === 0) return null;

  return (
    <>
      <div
        className="relative shrink-0 [-webkit-app-region:no-drag]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          title={t('drawer.actions')}
          aria-label={t('drawer.actions')}
          className={`flex size-7 items-center justify-center rounded-md transition-colors ${
            menuOpen ? 'bg-surface-2 text-ink' : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </button>
        {menuOpen && (
          <div
            className={`${menuClosing ? 'popover-out' : 'popover-in'} glass-panel absolute top-full right-0 z-30 mt-1.5 w-48 rounded-lg border border-hairline bg-surface-1 p-1 shadow-xl shadow-black/40`}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.run}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <span className="flex w-4 shrink-0 justify-center text-ink-subtle">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {snapOpen && (
        <SnapshotDialog
          page={page}
          onClose={() => setSnapOpen(false)}
          onRestored={onContentRestored}
        />
      )}
    </>
  );
}
