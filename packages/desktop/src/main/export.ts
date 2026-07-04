import { BrowserWindow, dialog } from 'electron';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { blocksToMarkdown } from '../shared/markdown';
import { fetchPageContentAnyWorkspace } from './notion-client';
import { readSettings } from './settings';

export interface SaveResult {
  saved: boolean;
  path?: string;
  error?: string;
}

export async function syncWorklogToFolder(opts: {
  pageId: string;
  fileBase: string;
  title: string;
  date: string | null;
}): Promise<void> {
  const cfg = readSettings().export;
  if (!cfg.autoSync || !cfg.folder) return;
  const content = await fetchPageContentAnyWorkspace(opts.pageId);
  if (content.blocks.length === 0) return;
  const md = blocksToMarkdown(content.blocks, {
    title: opts.title,
    date: opts.date,
    workspace: 'cairn',
  });
  await writeFile(join(cfg.folder, `${opts.fileBase}.md`), md, 'utf8');
}

export type ExportStatus = {
  folder: string | null;
  isVault: boolean;
  fileCount: number;
  lastSyncAt: number | null;
};

// 연동 탭 표시용 — .obsidian 존재로 vault 감지, YYYY-MM-DD*.md 만 집계(다른 노트 미포함)
export function exportStatus(): ExportStatus {
  const folder = readSettings().export.folder;
  if (!folder) return { folder: null, isVault: false, fileCount: 0, lastSyncAt: null };
  try {
    const isVault = existsSync(join(folder, '.obsidian'));
    const files = readdirSync(folder).filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f));
    let last: number | null = null;
    for (const f of files) {
      const m = statSync(join(folder, f)).mtimeMs;
      if (last === null || m > last) last = m;
    }
    return { folder, isVault, fileCount: files.length, lastSyncAt: last };
  } catch {
    return { folder, isVault: false, fileCount: 0, lastSyncAt: null };
  }
}

export async function pickExportFolder(): Promise<string | null> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : (r.filePaths[0] ?? null);
}

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
