import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { RichSpan, SimpleBlock } from '../cairn-api';

// 드로어·전체 화면 상세가 공유하는 일지 본문 렌더러 — 블록 문법 변경은 여기 한 곳에서

export function JournalBlocks({
  blocks,
  className = 'journal-content flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink',
}: {
  blocks: SimpleBlock[];
  className?: string;
}) {
  return (
    <div className={className}>
      {blocks.map((b) => (
        <Block key={b.id} b={b} />
      ))}
    </div>
  );
}

// 발행 일지는 plain text 라 링크 annotation 이 없어, 평문 URL 을 직접 링크화
const URL_SPLIT = /(https?:\/\/[^\s)]+)/g;
function linkify(text: string): ReactNode[] {
  return text.split(URL_SPLIT).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <button
        key={i}
        type="button"
        onClick={() => void window.cairn.openExternal(part)}
        className="text-accent underline-offset-2 hover:underline"
      >
        {part}
      </button>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Rich({ spans }: { spans: RichSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        const cls = [
          s.bold ? 'font-semibold text-ink' : '',
          s.italic ? 'italic' : '',
          s.strike ? 'line-through opacity-70' : '',
          s.code ? 'rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px]' : '',
        ].join(' ');
        if (s.href) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => s.href && void window.cairn.openExternal(s.href)}
              className={`${cls} text-accent hover:underline`}
            >
              {s.text}
            </button>
          );
        }
        return (
          <span key={i} className={cls || undefined}>
            {s.code ? s.text : linkify(s.text)}
          </span>
        );
      })}
    </>
  );
}

// Notion 코드블록 언어명 → highlight.js 식별자 (불일치하는 것만)
const LANG_ALIAS: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  'objective-c': 'objectivec',
  'plain text': 'plaintext',
  shell: 'bash',
  html: 'xml',
  markup: 'xml',
  docker: 'dockerfile',
  'vb.net': 'vbnet',
  'visual basic': 'vbnet',
  webassembly: 'wasm',
  'llvm ir': 'llvm',
};

// highlight.js(전체 언어, ~1.2MB)는 초기 번들에서 분리 — 코드블록이 처음 그려질 때 한 번만 로드
let hljsModule: typeof import('highlight.js').default | null = null;
let hljsLoading: Promise<typeof import('highlight.js').default> | null = null;
function loadHljs(): Promise<typeof import('highlight.js').default> {
  hljsLoading ??= import('highlight.js').then((m) => {
    hljsModule = m.default;
    return m.default;
  });
  return hljsLoading;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [ready, setReady] = useState(hljsModule !== null);
  useEffect(() => {
    if (!ready) void loadHljs().then(() => setReady(true));
  }, [ready]);
  const raw = (language ?? '').toLowerCase().trim();
  const mapped = LANG_ALIAS[raw] ?? raw;
  // 리사이즈 드래그 등 리렌더마다 전체 재하이라이트하지 않도록 memo (하이라이트는 O(코드 길이))
  const html = useMemo(() => {
    const hljs = hljsModule;
    if (!ready || !hljs) return null;
    const lang = mapped && hljs.getLanguage(mapped) ? mapped : undefined;
    return lang
      ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value;
  }, [ready, code, mapped]);
  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      {language && mapped !== 'plaintext' && (
        <div className="border-b border-hairline bg-surface-3 px-3 py-1 font-mono text-[10px] text-ink-tertiary select-none">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto bg-surface-2 p-3 text-[12px] leading-relaxed">
        {html === null ? (
          <code className="hljs font-mono">{code}</code>
        ) : (
          <code className="hljs font-mono" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </pre>
    </div>
  );
}

function Children({ blocks }: { blocks: SimpleBlock[] }) {
  return (
    <div className="ml-4 flex flex-col gap-1.5 border-l border-hairline pl-3">
      {blocks.map((c) => (
        <Block key={c.id} b={c} />
      ))}
    </div>
  );
}

function Block({ b }: { b: SimpleBlock }) {
  const kids = b.children && b.children.length > 0 ? <Children blocks={b.children} /> : null;

  if (b.type === 'toggle') {
    return (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-1 select-none marker:content-none hover:text-ink">
          <ChevronRight
            size={14}
            strokeWidth={2.25}
            className="mt-[3px] shrink-0 text-ink-tertiary transition-transform duration-200 group-open:rotate-90"
          />
          <span className="min-w-0">
            <Rich spans={b.rich} />
          </span>
        </summary>
        {kids && <div className="mt-1.5">{kids}</div>}
      </details>
    );
  }

  let body: React.ReactNode;
  switch (b.type) {
    case 'heading_1':
      body = (
        <h2 className="mt-3 text-[17px] font-semibold text-ink">
          <Rich spans={b.rich} />
        </h2>
      );
      break;
    case 'heading_2':
      body = (
        <h3 className="mt-2.5 text-[15px] font-semibold text-ink">
          <Rich spans={b.rich} />
        </h3>
      );
      break;
    case 'heading_3':
      body = (
        <h4 className="mt-2 text-[14px] font-semibold text-ink">
          <Rich spans={b.rich} />
        </h4>
      );
      break;
    case 'bulleted_list_item':
      body = (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">•</span>
          <span>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'numbered_list_item':
      body = (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">–</span>
          <span>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'to_do':
      body = (
        <p className="flex gap-2">
          <span className="text-ink-tertiary">{b.checked ? '☑' : '☐'}</span>
          <span className={b.checked ? 'line-through opacity-60' : ''}>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'quote':
      body = (
        <p className="border-l-2 border-hairline-strong pl-3 text-ink-subtle">
          <Rich spans={b.rich} />
        </p>
      );
      break;
    case 'callout':
      body = (
        <p className="flex gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2">
          {b.iconUrl ? (
            <img src={b.iconUrl} alt="" className="mt-0.5 h-4 w-4 shrink-0 rounded-sm" />
          ) : (
            b.icon && <span className="shrink-0">{b.icon}</span>
          )}
          <span>
            <Rich spans={b.rich} />
          </span>
        </p>
      );
      break;
    case 'code':
      body = <CodeBlock code={b.rich.map((s) => s.text).join('')} language={b.language} />;
      break;
    case 'divider':
      body = <hr className="my-2 border-hairline" />;
      break;
    default:
      body =
        b.rich.length > 0 ? (
          <p>
            <Rich spans={b.rich} />
          </p>
        ) : (
          <div className="h-1.5" />
        );
  }

  return (
    <>
      {body}
      {kids}
    </>
  );
}
