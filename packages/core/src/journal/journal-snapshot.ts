import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SNAPSHOT_ROOT = join(homedir(), '.cairn', 'snapshots');
export const KEEP_PER_FILE = 10;

export function snapshotStamp(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

// 파일명(상대 키) 기반 — 절대경로 키는 폴더 이동 시 스냅샷 고아를 만든다
export function snapshotDirFor(fileName: string, root = SNAPSHOT_ROOT): string {
  return join(root, fileName.replace(/\.md$/, ''));
}

// 덮어쓰기 직전의 이전본 보존. 내용이 같으면 저장 안 함. 저장했으면 true
export function saveSnapshotIfChanged(
  currentPath: string,
  fileName: string,
  nextContent: string,
  now = new Date(),
  root = SNAPSHOT_ROOT,
): boolean {
  if (!existsSync(currentPath)) return false;
  const prev = readFileSync(currentPath, 'utf8');
  if (prev === nextContent) return false;
  const dir = snapshotDirFor(fileName, root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${snapshotStamp(now)}.md`), prev, 'utf8');
  pruneSnapshots(dir);
  return true;
}

// 파일당 최근 KEEP_PER_FILE 개만 보존 (타임스탬프 파일명이라 사전순 = 시간순)
export function pruneSnapshots(dir: string): void {
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
