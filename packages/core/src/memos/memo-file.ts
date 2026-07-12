import { assertNoForbiddenPayload } from '../common/sanitize.js';

export interface MemoEntry {
  text: string;
  at?: string;
}

export type MemosFile = Record<string, MemoEntry[]>;

export const MAX_MEMOS_PER_DAY = 20;
export const MAX_MEMO_CHARS = 300;

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
      if (typeof text !== 'string') continue;
      const at = (e as { at?: unknown }).at;
      list.push({ text, ...(typeof at === 'string' ? { at } : {}) });
    }
    if (list.length > 0) out[date] = list;
  }
  return out;
}

export function memoTextsForDate(file: MemosFile, date: string): string[] {
  return (file[date] ?? [])
    .map((e) => e.text.trim())
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, MAX_MEMO_CHARS))
    .slice(0, MAX_MEMOS_PER_DAY);
}

// 자유 텍스트라 마스킹 대신 항목 drop (ADR 0021) — 경로·토큰·이메일이 섞인 메모만 버린다
export function dropForbiddenMemos(texts: readonly string[]): { kept: string[]; dropped: number } {
  const kept: string[] = [];
  let dropped = 0;
  for (const text of texts) {
    try {
      assertNoForbiddenPayload(text, 'memos.item');
      kept.push(text);
    } catch {
      dropped += 1;
    }
  }
  return { kept, dropped };
}
