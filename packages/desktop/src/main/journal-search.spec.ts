import { describe, expect, it } from 'vitest';
import { journalFileCategory, stripFrontmatter } from './journal-files';
import { searchJournals, type JournalSearchFile } from './journal-search';

const file = (fileName: string, body: string): JournalSearchFile => ({
  fileName,
  category: 'daily',
  body,
});

describe('searchJournals — 토큰 매칭', () => {
  it('공백 분리 토큰 AND — 전부 포함한 파일만', () => {
    const files = [
      file('2026-07-01.md', '- [cairn] 프로젝트 뷰 스트리밍 렌더 구현'),
      file('2026-07-02.md', '- [cairn] 스트리밍 없음, 다른 작업'),
    ];
    const hits = searchJournals(files, '스트리밍 렌더');
    expect(hits.map((h) => h.fileName)).toEqual(['2026-07-01.md']);
  });

  it('대소문자 무시', () => {
    const files = [file('2026-07-01.md', '- [Cairn] Reports view fix')];
    expect(searchJournals(files, 'reports')).toHaveLength(1);
    expect(searchJournals(files, 'CAIRN')).toHaveLength(1);
  });

  it('[레포] 브래킷 프리픽스도 그냥 substring 으로 매칭', () => {
    const files = [
      file('2026-07-01.md', '- [cairn] 작업 A'),
      file('2026-07-02.md', '- [other] 작업 B'),
    ];
    expect(searchJournals(files, '[cairn]').map((h) => h.fileName)).toEqual(['2026-07-01.md']);
  });

  it('빈 쿼리·1글자 쿼리·매칭 없음 → []', () => {
    const files = [file('2026-07-01.md', '- 작업')];
    expect(searchJournals(files, '')).toEqual([]);
    expect(searchJournals(files, '  ')).toEqual([]);
    expect(searchJournals(files, 'x')).toEqual([]);
    expect(searchJournals(files, '없는토큰')).toEqual([]);
  });
});

describe('searchJournals — 스니펫', () => {
  it('첫 매치 라인에서 불릿·헤딩 기호를 걷어내고 매치를 포함', () => {
    const files = [file('2026-07-01.md', '## Done\n- [cairn] 스캔 배치 최적화 작업')];
    const [hit] = searchJournals(files, '배치');
    expect(hit!.snippet).toContain('배치');
    expect(hit!.snippet.startsWith('-')).toBe(false);
    expect(hit!.snippet.startsWith('#')).toBe(false);
  });

  it('긴 라인은 매치 주변만 잘라 … 로 표시', () => {
    const long = `${'a'.repeat(120)} 타깃토큰 ${'b'.repeat(120)}`;
    const [hit] = searchJournals([file('2026-07-01.md', long)], '타깃토큰');
    expect(hit!.snippet).toContain('타깃토큰');
    expect(hit!.snippet.startsWith('…')).toBe(true);
    expect(hit!.snippet.endsWith('…')).toBe(true);
    expect(hit!.snippet.length).toBeLessThan(120);
  });
});

describe('searchJournals — 정렬·상한', () => {
  it('매치수 내림차순, 동률은 파일명(날짜) 내림차순', () => {
    const files = [
      file('2026-07-01.md', 'foo foo foo'),
      file('2026-07-02.md', 'foo'),
      file('2026-07-03.md', 'foo'),
    ];
    expect(searchJournals(files, 'foo').map((h) => h.fileName)).toEqual([
      '2026-07-01.md',
      '2026-07-03.md',
      '2026-07-02.md',
    ]);
  });

  it('결과 50개 상한', () => {
    const files = Array.from({ length: 60 }, (_, i) =>
      file(`2026-01-${String(i + 1).padStart(2, '0')}.md`, 'foo'),
    );
    expect(searchJournals(files, 'foo')).toHaveLength(50);
  });
});

describe('stripFrontmatter — 본문 검색은 frontmatter 를 제외', () => {
  it('fm 파싱 + body 에서 fm 제거 (검색이 fm 토큰에 오매칭하지 않는 근거)', () => {
    const raw = '---\ntitle: "2026-07-01 작업 일지"\nnotion: abc123\n---\n본문 내용';
    const { fm, body } = stripFrontmatter(raw);
    expect(fm.get('title')).toBe('2026-07-01 작업 일지');
    expect(body).toBe('본문 내용');
    expect(body).not.toContain('abc123');
  });

  it('CRLF 정규화 + 닫는 --- 없으면 원문 전체가 body', () => {
    const { body } = stripFrontmatter('---\r\ntitle: x\r\n---\r\nbody');
    expect(body).toBe('body');
    const malformed = stripFrontmatter('---\ntitle: x\nbody without close');
    expect(malformed.body).toBe('---\ntitle: x\nbody without close');
  });
});

describe('journalFileCategory — 스캔 대상 경로 가드', () => {
  it('journal 파일명 패턴만 카테고리 부여', () => {
    expect(journalFileCategory('2026-07-24.md')).toBe('daily');
    expect(journalFileCategory('2026-W30.md')).toBe('weekly');
    expect(journalFileCategory('2026-07.md')).toBe('monthly');
    expect(journalFileCategory('2026.md')).toBe('yearly');
  });

  it('패턴 밖 파일명(경로 조작·임의 md)은 제외', () => {
    expect(journalFileCategory('../etc')).toBeUndefined();
    expect(journalFileCategory('secrets.md')).toBeUndefined();
    expect(journalFileCategory('x2026-07-24.md')).toBeUndefined();
    expect(journalFileCategory('2026-07-24.md.bak')).toBeUndefined();
  });
});
