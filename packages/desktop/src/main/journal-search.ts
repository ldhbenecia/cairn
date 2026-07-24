import type { RecentCategory } from './notion-client';

// 일지 본문 검색 — 순수 매칭/스니펫 로직. I/O(파일 읽기)는 journal-reader.searchJournalContents 가
// 담당하고 여기는 입력 데이터만 받는다(타입 import 뿐이라 단위 테스트 가능).
// 목록 검색(제목=날짜)이 못 잡던 본문·[레포] 프리픽스를 substring 토큰 AND 로 매칭한다

export type JournalSearchFile = {
  fileName: string;
  category: RecentCategory;
  body: string;
};

export type JournalSearchHit = {
  fileName: string;
  category: RecentCategory;
  snippet: string;
  matchCount: number;
};

// 결과 상한 — 초과분은 잘라 UI 가 감당할 크기로 (쿼리를 더 좁히면 됨)
const MAX_HITS = 50;
// 스니펫 컨텍스트 — 매치 지점 앞뒤로 보여줄 문자 수
const SNIPPET_RADIUS = 44;

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// 첫 매치 라인에서 마크다운 노이즈(불릿·헤딩 기호)를 걷어내고 매치 주변만 잘라낸 스니펫
function buildSnippet(body: string, token: string): string {
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/^[#>\s*-]+/, '').trim();
    if (!line) continue;
    const idx = line.toLowerCase().indexOf(token);
    if (idx === -1) continue;
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(line.length, idx + token.length + SNIPPET_RADIUS);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < line.length ? '…' : '';
    return `${prefix}${line.slice(start, end)}${suffix}`;
  }
  return '';
}

export function searchJournals(
  files: readonly JournalSearchFile[],
  query: string,
): JournalSearchHit[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // 1글자 쿼리는 잡음이 큼 — 토큰 전체 길이 2 미만이면 검색하지 않는다
  if (tokens.length === 0 || tokens.join('').length < 2) return [];

  const hits: JournalSearchHit[] = [];
  for (const f of files) {
    const lower = f.body.toLowerCase();
    if (!tokens.every((t) => lower.includes(t))) continue;
    const matchCount = tokens.reduce((n, t) => n + countOccurrences(lower, t), 0);
    hits.push({
      fileName: f.fileName,
      category: f.category,
      snippet: buildSnippet(f.body, tokens[0]!),
      matchCount,
    });
  }
  // 매치수 내림차순, 동률은 파일명(=날짜 인코딩) 내림차순 — 최근 일지 우선
  hits.sort((a, b) => b.matchCount - a.matchCount || b.fileName.localeCompare(a.fileName));
  return hits.slice(0, MAX_HITS);
}
