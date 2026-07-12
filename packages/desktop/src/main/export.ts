import { BrowserWindow, dialog } from 'electron';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { blocksToMarkdown } from '../shared/markdown';
import { journalFolder } from './journal-reader';
import { fetchPageContentAnyWorkspace, type RecentCategory } from './notion-client';
import { readSettings } from './settings';
import { journalFileNameFor } from './worklog-sinks';

export interface SaveResult {
  saved: boolean;
  path?: string;
  error?: string;
}

// 1차 소스는 journal 파일 복사 — front-matter 가 그대로 실리고, 노션 미연동(로컬 온리)에서도
// autoSync 가 동작한다 (plan 2026-07-05: 노션 콘텐츠 기반 → journal 복사 기반 전환).
// journal 이 없는 항목(구버전 발행 등)만 기존 노션 fetch 로 폴백.
export async function syncWorklogToFolder(opts: {
  category: RecentCategory;
  date: string | null;
  fileBase: string;
  title: string;
  pageId: string | null;
}): Promise<void> {
  const cfg = readSettings().export;
  if (!cfg.autoSync || !cfg.folder) return;

  if (opts.date) {
    const fileName = journalFileNameFor(opts.category, opts.date);
    if (fileName) {
      try {
        const raw = await readFile(join(await journalFolder(), fileName), 'utf8');
        await writeFile(join(cfg.folder, `${opts.fileBase}.md`), raw, 'utf8');
        return;
      } catch {
        // journal 파일 없음/읽기 실패 — 노션 폴백으로 계속
      }
    }
  }

  if (!opts.pageId) return;
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

// 연동 탭 표시용 — .obsidian 존재로 vault 감지, YYYY-MM-DD*.md 만 집계(다른 노트 미포함).
// 대형 vault 에서 메인 프로세스가 얼지 않게 비동기 fs 사용 (#242 리뷰)
export async function exportStatus(): Promise<ExportStatus> {
  const folder = readSettings().export.folder;
  if (!folder) return { folder: null, isVault: false, fileCount: 0, lastSyncAt: null };
  try {
    const isVault = existsSync(join(folder, '.obsidian'));
    const files = (await readdir(folder)).filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f));
    const stats = await Promise.all(files.map((f) => stat(join(folder, f))));
    let last: number | null = null;
    for (const st of stats) {
      if (last === null || st.mtimeMs > last) last = st.mtimeMs;
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
