import type { MdBlock, MdSpan } from './markdown';

// 일지 블록 → 자체 스타일 HTML 문서. main 이 오프스크린 창에 로드해 printToPDF 로 PDF 화.
// data: URL 로 싣기 때문에 CSS 는 인라인으로 자기완결.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function richToHtml(spans: MdSpan[]): string {
  return spans
    .map((s) => {
      let html = escapeHtml(s.text);
      if (s.code) html = `<code>${html}</code>`;
      if (s.bold) html = `<strong>${html}</strong>`;
      if (s.italic) html = `<em>${html}</em>`;
      if (s.strike) html = `<del>${html}</del>`;
      if (s.href) html = `<a href="${escapeHtml(s.href)}">${html}</a>`;
      return html;
    })
    .join('');
}

function blockToHtml(b: MdBlock): string {
  const text = richToHtml(b.rich);
  const kids = (b.children ?? []).map(blockToHtml).join('');
  switch (b.type) {
    case 'heading_1':
      return `<h2>${text}</h2>`;
    case 'heading_2':
      return `<h3>${text}</h3>`;
    case 'heading_3':
      return `<h4>${text}</h4>`;
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'toggle':
      return `<li>${text}${kids ? `<ul>${kids}</ul>` : ''}</li>`;
    case 'to_do':
      return `<li>${b.checked ? '☑' : '☐'} ${text}</li>`;
    case 'quote':
    case 'callout':
      return `<blockquote>${b.icon ? `${escapeHtml(b.icon)} ` : ''}${text}</blockquote>`;
    case 'code':
      return `<pre><code>${escapeHtml(b.rich.map((s) => s.text).join(''))}</code></pre>`;
    case 'divider':
      return '<hr/>';
    default:
      return text ? `<p>${text}</p>` : '';
  }
}

// 인접한 list item 들을 <ul> 로 묶는다.
function wrapBlocks(blocks: MdBlock[]): string {
  const out: string[] = [];
  let listBuf: string[] = [];
  const flush = (): void => {
    if (listBuf.length > 0) {
      out.push(`<ul>${listBuf.join('')}</ul>`);
      listBuf = [];
    }
  };
  const isList = (t: string): boolean =>
    t === 'bulleted_list_item' || t === 'numbered_list_item' || t === 'to_do' || t === 'toggle';
  for (const b of blocks) {
    if (isList(b.type)) listBuf.push(blockToHtml(b));
    else {
      flush();
      out.push(blockToHtml(b));
    }
  }
  flush();
  return out.join('\n');
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Inter', system-ui, sans-serif; color: #1c1c22;
    line-height: 1.6; font-size: 13px; margin: 0; padding: 40px 44px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
  .meta { color: #8a8a94; font-size: 12px; margin: 0 0 24px; font-family: ui-monospace, monospace; }
  h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 1px solid #ececf0; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 18px 0 6px; }
  h4 { font-size: 13px; margin: 14px 0 4px; color: #44444c; }
  ul { margin: 4px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  p { margin: 6px 0; }
  blockquote { margin: 8px 0; padding: 2px 12px; border-left: 3px solid #d8d8de; color: #55555e; }
  code { background: #f2f2f5; border-radius: 4px; padding: 1px 5px; font-size: 12px;
    font-family: ui-monospace, monospace; }
  pre { background: #f7f7f9; border: 1px solid #ececf0; border-radius: 6px; padding: 12px;
    overflow-x: auto; }
  pre code { background: none; padding: 0; }
  a { color: #474dcc; text-decoration: none; }
  hr { border: none; border-top: 1px solid #ececf0; margin: 16px 0; }
`;

export function blocksToHtml(
  blocks: MdBlock[],
  meta: { title: string; date: string | null; workspace: string },
): string {
  const metaLine = [meta.date, meta.workspace].filter(Boolean).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${STYLE}</style></head>
<body><h1>${escapeHtml(meta.title)}</h1><p class="meta">${escapeHtml(metaLine)}</p>
${wrapBlocks(blocks)}</body></html>`;
}
