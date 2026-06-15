import type { RichSpan, SimpleBlock } from '../cairn-api';

// 일지 페이지 블록(Notion 에서 읽어온 SimpleBlock) → Markdown 문자열.
// drawer 렌더링과 같은 블록 타입을 다룬다. Obsidian·일반 .md 양쪽에서 자연스럽게 열린다.

function richToMarkdown(spans: RichSpan[]): string {
  return spans
    .map((s) => {
      let text = s.text;
      if (s.code) text = `\`${text}\``;
      if (s.bold) text = `**${text}**`;
      if (s.italic) text = `*${text}*`;
      if (s.strike) text = `~~${text}~~`;
      if (s.href) text = `[${text}](${s.href})`;
      return text;
    })
    .join('');
}

function blockToMarkdown(b: SimpleBlock, depth: number): string[] {
  const indent = '  '.repeat(depth);
  const text = richToMarkdown(b.rich);
  const lines: string[] = [];

  switch (b.type) {
    case 'heading_1':
      lines.push(`## ${text}`);
      break;
    case 'heading_2':
      lines.push(`### ${text}`);
      break;
    case 'heading_3':
      lines.push(`#### ${text}`);
      break;
    case 'bulleted_list_item':
      lines.push(`${indent}- ${text}`);
      break;
    case 'numbered_list_item':
      lines.push(`${indent}1. ${text}`);
      break;
    case 'to_do':
      lines.push(`${indent}- [${b.checked ? 'x' : ' '}] ${text}`);
      break;
    case 'toggle':
      lines.push(`${indent}- ${text}`);
      break;
    case 'quote':
      lines.push(`> ${text}`);
      break;
    case 'callout':
      lines.push(`> ${b.icon ? `${b.icon} ` : ''}${text}`);
      break;
    case 'code':
      lines.push(`\`\`\`${b.language ?? ''}`, b.rich.map((s) => s.text).join(''), '```');
      break;
    case 'divider':
      lines.push('---');
      break;
    default:
      if (text) lines.push(text);
  }

  for (const child of b.children ?? []) {
    lines.push(...blockToMarkdown(child, depth + 1));
  }
  return lines;
}

// 페이지 제목 + 메타(date·workspace) frontmatter + 본문. Obsidian frontmatter 호환.
export function blocksToMarkdown(
  blocks: SimpleBlock[],
  meta: { title: string; date: string | null; workspace: string },
): string {
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(meta.title)}`,
    ...(meta.date ? [`date: ${meta.date}`] : []),
    `workspace: ${JSON.stringify(meta.workspace)}`,
    'source: cairn',
    '---',
    '',
  ];
  const body: string[] = [`# ${meta.title}`, ''];
  for (const b of blocks) {
    const md = blockToMarkdown(b, 0);
    if (md.length === 0) continue;
    body.push(...md, '');
  }
  return (
    [...frontmatter, ...body]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
