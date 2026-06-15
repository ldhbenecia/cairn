import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { blocksToMarkdown } from '../shared/markdown';
import { fetchPageContent } from './notion-client';
import { readSettings } from './settings';

export interface SaveResult {
  saved: boolean;
  path?: string;
  error?: string;
}

// 발행 시 자동 동기화 — export.autoSync + folder 설정 시 발행된 일지를 그 폴더에 .md 로 쓴다.
// folder 가 Obsidian vault 면 곧 Obsidian 연동. 실패는 발행을 막지 않는다(fire-and-forget).
export async function syncWorklogToFolder(opts: {
  pageId: string;
  fileBase: string;
  title: string;
  date: string | null;
}): Promise<void> {
  const cfg = readSettings().export;
  if (!cfg.autoSync || !cfg.folder) return;
  const content = await fetchPageContent(opts.pageId, '');
  if (content.blocks.length === 0) return;
  const md = blocksToMarkdown(content.blocks, {
    title: opts.title,
    date: opts.date,
    workspace: 'cairn',
  });
  await writeFile(join(cfg.folder, `${opts.fileBase}.md`), md, 'utf8');
}

export async function pickExportFolder(): Promise<string | null> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : (r.filePaths[0] ?? null);
}

// 렌더러가 만든 HTML 문서를 오프스크린 창에 싣고 printToPDF 로 PDF 저장.
export async function savePdf(defaultName: string, html: string): Promise<SaveResult> {
  const r = await dialog.showSaveDialog({
    defaultPath: join(homedir(), 'Documents', defaultName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return { saved: false };

  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
    });
    await writeFile(r.filePath, pdf);
    return { saved: true, path: r.filePath };
  } catch (e) {
    return { saved: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    win.destroy();
  }
}

// 일지 Markdown 을 저장 다이얼로그로 파일에 쓴다. 파일명 기본값은 일지 날짜/제목 기반.
export async function saveMarkdown(defaultName: string, content: string): Promise<SaveResult> {
  const r = await dialog.showSaveDialog({
    defaultPath: join(homedir(), 'Documents', defaultName),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (r.canceled || !r.filePath) return { saved: false };
  try {
    await writeFile(r.filePath, content, 'utf8');
    return { saved: true, path: r.filePath };
  } catch (e) {
    return { saved: false, error: e instanceof Error ? e.message : String(e) };
  }
}
