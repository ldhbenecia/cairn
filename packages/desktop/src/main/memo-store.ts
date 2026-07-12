import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { withFileLock } from './file-lock';

export type MemoEntry = { text: string; at: string };
export type MemosFile = Record<string, MemoEntry[]>;

const MEMOS_DIR = join(homedir(), '.cairn');
const MEMOS_PATH = join(MEMOS_DIR, 'memos.json');

export const MAX_MEMO_CHARS = 300;
// core 읽기 상한(memo-file.ts)과 일치
export const MAX_MEMOS_PER_DAY = 20;
const KEEP_DAYS = 60;

// 로컬 날짜 — KST 단정 금지 (timezone 룰)
export function todayLocalIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseMemosFile(raw: string): MemosFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: MemosFile = {};
  for (const [date, entries] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    const list: MemoEntry[] = [];
    for (const e of entries) {
      const text = (e as { text?: unknown } | null)?.text;
      const at = (e as { at?: unknown } | null)?.at;
      if (typeof text === 'string') list.push({ text, at: typeof at === 'string' ? at : '' });
    }
    if (list.length > 0) out[date] = list;
  }
  return out;
}

export function appendMemoEntry(file: MemosFile, date: string, entry: MemoEntry): MemosFile {
  return { ...file, [date]: [...(file[date] ?? []), entry] };
}

export function pruneBefore(file: MemosFile, cutoffDate: string): MemosFile {
  const out: MemosFile = {};
  for (const [date, entries] of Object.entries(file)) {
    if (date >= cutoffDate) out[date] = entries;
  }
  return out;
}

export function addMemo(rawText: string): { ok: boolean; count: number } {
  const text = rawText.trim();
  // truncate 금지 — 반토막 나면 core egress 패턴 회피
  if (!text || text.length > MAX_MEMO_CHARS) return { ok: false, count: 0 };
  const now = new Date();
  const date = todayLocalIsoDate(now);
  const cutoff = todayLocalIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_DAYS),
  );
  try {
    mkdirSync(MEMOS_DIR, { recursive: true });
    // 락 안 read-modify-write — forked core 와 lost-update 방지
    return withFileLock(MEMOS_PATH, () => {
      let file: MemosFile = {};
      try {
        file = parseMemosFile(readFileSync(MEMOS_PATH, 'utf8'));
      } catch {
        /* 파일 없음/깨짐 — 빈 상태 */
      }
      const pruned = pruneBefore(file, cutoff);
      const todayCount = pruned[date]?.length ?? 0;
      if (todayCount >= MAX_MEMOS_PER_DAY) return { ok: false, count: todayCount };
      const next = appendMemoEntry(pruned, date, {
        text,
        at: now.toISOString(),
      });
      const tmp = `${MEMOS_PATH}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(next), 'utf8');
      renameSync(tmp, MEMOS_PATH);
      return { ok: true, count: next[date]!.length };
    });
  } catch {
    return { ok: false, count: 0 };
  }
}
