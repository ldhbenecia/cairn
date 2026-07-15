import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './atomic-write';
import { journalFolder } from './journal-reader';
import type { RecentCategory } from './notion-client';
import { journalFileNameFor } from './worklog-sinks';

// 저장 포맷 소유: core/src/journal/journal-snapshot.ts (드리프트 주의)
const SNAPSHOT_ROOT = join(homedir(), '.cairn', 'snapshots');
const KEEP_PER_FILE = 10;
const STAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;

export type JournalSnapshotMeta = { stamp: string; at: string };

export function stampToIso(stamp: string): string | null {
  const m = STAMP_RE.exec(stamp);
  if (!m) return null;
  return `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
}

function snapshotDir(fileName: string): string {
  return join(SNAPSHOT_ROOT, fileName.replace(/\.md$/, ''));
}

function resolveFileName(category: RecentCategory, date: string): string | null {
  return journalFileNameFor(category, date);
}

export function listJournalSnapshots(
  category: RecentCategory,
  date: string,
): JournalSnapshotMeta[] {
  const fileName = resolveFileName(category, date);
  if (!fileName) return [];
  let files: string[];
  try {
    files = readdirSync(snapshotDir(fileName));
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .filter((stamp) => STAMP_RE.test(stamp))
    .sort()
    .reverse()
    .map((stamp) => ({ stamp, at: stampToIso(stamp)! }));
}

// stamp 'current' 는 journal 원본 — diff 비교용
export async function readJournalSnapshot(
  category: RecentCategory,
  date: string,
  stamp: string,
): Promise<{ content: string | null }> {
  const fileName = resolveFileName(category, date);
  if (!fileName) return { content: null };
  try {
    if (stamp === 'current') {
      return { content: readFileSync(join(await journalFolder(), fileName), 'utf8') };
    }
    if (!STAMP_RE.test(stamp)) return { content: null };
    return { content: readFileSync(join(snapshotDir(fileName), `${stamp}.md`), 'utf8') };
  } catch {
    return { content: null };
  }
}

export async function restoreJournalSnapshot(
  category: RecentCategory,
  date: string,
  stamp: string,
): Promise<{ ok: boolean }> {
  const fileName = resolveFileName(category, date);
  if (!fileName || !STAMP_RE.test(stamp)) return { ok: false };
  try {
    const snapshot = readFileSync(join(snapshotDir(fileName), `${stamp}.md`), 'utf8');
    const journalPath = join(await journalFolder(), fileName);
    // 복원도 되돌릴 수 있게 — 현재본을 먼저 스냅샷
    if (existsSync(journalPath)) {
      const current = readFileSync(journalPath, 'utf8');
      if (current !== snapshot) {
        const dir = snapshotDir(fileName);
        mkdirSync(dir, { recursive: true });
        const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
        await writeFile(join(dir, `${nowStamp}.md`), current, 'utf8');
        prune(dir);
      }
    }
    writeFileAtomic(journalPath, snapshot);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function prune(dir: string): void {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort();
  } catch {
    return;
  }
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_PER_FILE))) {
    rmSync(join(dir, f), { force: true });
  }
}
