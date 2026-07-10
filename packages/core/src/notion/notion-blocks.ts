import { CLAUDE_ICON_URL } from '../common/branding.js';

// Notion rich_text text.content 한도 2000자 — 초과분은 같은 블록 안에서 여러 rich_text 로 분할.
// 스키마가 2000 을 강제하지만 사용자 편집 journal 재발행 등 스키마 밖 텍스트가 들어오는 경로 방어
const RICH_TEXT_MAX = 2000;

function richText(text: string): { type: 'text'; text: { content: string } }[] {
  if (text.length <= RICH_TEXT_MAX) return [{ type: 'text', text: { content: text } }];
  const chunks: { type: 'text'; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: text.slice(i, i + RICH_TEXT_MAX) } });
  }
  return chunks;
}

export function claudeCallout(text: string): unknown {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'external', external: { url: CLAUDE_ICON_URL } },
      rich_text: richText(text),
    },
  };
}

export function callout(emoji: string, text: string): unknown {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji },
      rich_text: richText(text),
    },
  };
}

export function heading2(text: string): unknown {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: richText(text),
    },
  };
}

export function heading3(text: string): unknown {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: richText(text),
    },
  };
}

export function paragraph(text: string): unknown {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: richText(text),
    },
  };
}

export function bulletItem(text: string): unknown {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: richText(text),
    },
  };
}

export function codeBlock(language: string, content: string): unknown {
  return {
    object: 'block',
    type: 'code',
    code: {
      language,
      rich_text: richText(content),
    },
  };
}

export function bulletsOrEmpty(items: readonly string[]): unknown[] {
  if (items.length === 0) return [paragraph('—')];
  return items.map((t) => bulletItem(t));
}
