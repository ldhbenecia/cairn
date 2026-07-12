import type { ExtractedBlock } from '../notion/notion-api.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';

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

// daily journal 블록 → WorklogSummary 복원 — renderDailyJournalMarkdown 의 역방향.
// Notion 발행만 실패한 날짜를 재요약 없이 journal 로 재발행하는 경로에서 사용
export function blocksToWorklogSummary(blocks: readonly ExtractedBlock[]): WorklogSummary | null {
  // Summary 는 다중 문단 허용 — 요약 paragraph 에 개행이 있으면 렌더 시 문단 여러 개로
  // 나뉘는데, 첫 문단만 취하면 재발행 왕복에서 뒷문단이 유실된다
  const paragraphs: string[] = [];
  const sections: Record<string, string[]> = {
    share: [],
    done: [],
    reviewed: [],
    'in progress': [],
    notes: [],
  };
  let section: string | null = null;

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      section = block.text.toLowerCase().trim();
      continue;
    }
    if (block.type === 'paragraph' && section === 'summary') {
      const text = block.text.trim();
      if (text && text !== '—') paragraphs.push(text);
      continue;
    }
    if (block.type === 'bulleted_list_item' && section && section in sections) {
      const text = block.text.trim();
      if (text) sections[section]!.push(text);
    }
  }
  const paragraph = paragraphs.join('\n\n');

  const empty = !paragraph && Object.values(sections).every((bullets) => bullets.length === 0);
  if (empty) return null;
  return {
    paragraph,
    shareBullets: sections['share']!,
    doneBullets: sections['done']!,
    reviewedBullets: sections['reviewed']!,
    inProgressBullets: sections['in progress']!,
    notesBullets: sections['notes']!,
  };
}
