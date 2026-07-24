import type { RecentCategory } from './notion-client';

// journal 파일명 계약·frontmatter 파서 — journal-reader 에서 분리한 순수 로직.
// 타입만 import(런타임 erase)라 heavy 의존이 없어 단위 테스트 가능(검색 스펙이 함께 사용)

export const FILE_PATTERNS: { re: RegExp; category: RecentCategory }[] = [
  { re: /^\d{4}-\d{2}-\d{2}\.md$/, category: 'daily' },
  { re: /^\d{4}-W\d{2}\.md$/, category: 'weekly' },
  { re: /^\d{4}-\d{2}\.md$/, category: 'monthly' },
  { re: /^\d{4}\.md$/, category: 'yearly' },
];

export function journalFileCategory(name: string): RecentCategory | undefined {
  return FILE_PATTERNS.find((p) => p.re.test(name))?.category;
}

export function stripFrontmatter(raw: string): { fm: Map<string, string>; body: string } {
  const fm = new Map<string, string>();
  // 외부 에디터가 CRLF 로 저장할 수 있다 — 파싱 전 정규화
  const text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { fm, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm, body: text };
  for (const line of text.slice(4, end).split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value) as string;
      } catch {
        /* 원문 유지 */
      }
    }
    fm.set(key, value);
  }
  return { fm, body: text.slice(end + 5) };
}
