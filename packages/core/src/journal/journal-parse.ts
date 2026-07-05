import type { ExtractedBlock } from '../notion/notion-api.types.js';

export interface ParsedJournalFile {
  fm: Map<string, string>;
  blocks: ExtractedBlock[];
}

// journal md 는 자체 생성물(헤딩·불릿·문단)이라 이 범위만 블록으로 복원한다.
// 외부 에디터가 CRLF 로 저장할 수 있어 파싱 전 정규화.
export function parseJournalFile(raw: string): ParsedJournalFile {
  const text = raw.replace(/\r\n/g, '\n');
  const { fm, body } = stripFrontmatter(text);
  return { fm, blocks: markdownToBlocks(body) };
}

function stripFrontmatter(text: string): { fm: Map<string, string>; body: string } {
  const fm = new Map<string, string>();
  if (!text.startsWith('---\n')) return { fm, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm, body: text };
  for (const line of text.slice(4, end).split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    fm.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return { fm, body: text.slice(end + 5) };
}

function markdownToBlocks(body: string): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('# ')) continue;
    if (trimmed.startsWith('## ')) blocks.push({ type: 'heading_2', text: trimmed.slice(3) });
    else if (trimmed.startsWith('- '))
      blocks.push({ type: 'bulleted_list_item', text: trimmed.slice(2) });
    else blocks.push({ type: 'paragraph', text: trimmed });
  }
  return blocks;
}
