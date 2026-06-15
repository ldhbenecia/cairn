import { dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SaveResult {
  saved: boolean;
  path?: string;
  error?: string;
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
