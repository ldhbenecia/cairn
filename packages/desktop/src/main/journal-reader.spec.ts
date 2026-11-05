import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cfg = vi.hoisted(() => ({ folder: '' }));
vi.mock('./files', () => ({
  readConfig: () => Promise.resolve({ parsed: { journal: { folder: cfg.folder } } }),
}));
vi.mock('./notion-client', () => ({ listRecentPages: vi.fn() }));
vi.mock('./settings', () => ({ readSettings: vi.fn() }));

import { listJournalPages, searchJournalContents } from './journal-reader';

const page = (date: string, pr: number, body: string) =>
  `---\ntitle: ${date} 작업 일지\ndate: ${date}\npr: ${pr}\n---\n${body}\n`;

beforeEach(() => {
  cfg.folder = mkdtempSync(join(tmpdir(), 'journal-'));
});
afterEach(() => rmSync(cfg.folder, { recursive: true, force: true }));

describe('journal 캐시', () => {
  it('바뀐 파일은 다시 읽고, 지운 파일은 목록에서 빠짐', async () => {
    const a = join(cfg.folder, '2026-11-04.md');
    const b = join(cfg.folder, '2026-11-05.md');
    writeFileSync(a, page('2026-11-04', 1, '- 캐시 도입'));
    writeFileSync(b, page('2026-11-05', 2, '- 로그인'));
    writeFileSync(join(cfg.folder, 'notes.txt'), 'ignored');

    expect((await listJournalPages()).map((p) => [p.date, p.pr])).toEqual([
      ['2026-11-05', 2],
      ['2026-11-04', 1],
    ]);

    // 크기가 달라지는 수정 — mtime 해상도와 무관하게 무효화
    writeFileSync(b, page('2026-11-05', 12, '- 로그인 + 엔진 상태 팝오버'));
    expect((await listJournalPages())[0]?.pr).toBe(12);
    expect(await searchJournalContents('팝오버')).toHaveLength(1);

    rmSync(a);
    expect((await listJournalPages()).map((p) => p.date)).toEqual(['2026-11-05']);
    expect(await searchJournalContents('캐시')).toHaveLength(0);
  });
});
