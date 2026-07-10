import { describe, expect, it } from 'vitest';
import { createExtractor } from './core-runner-extract';

// 옛 방식: stdout 전체를 정규식으로 스캔(마지막 매치). 신 증분 추출기와 등가여야 한다.
function legacyScan(all: string) {
  const url = all.match(/https:\/\/www\.notion\.so\/\S+/g) ?? [];
  const kind = [...all.matchAll(/"kind"\s*:\s*"(created|recreated|skipped|no-target)"/g)];
  const pid = [...all.matchAll(/"pageId"\s*:\s*"([0-9a-f-]{32,36})"/g)];
  const jf = [...all.matchAll(/^(?=.*journal write done).*"fileName"\s*:\s*"([^"]+\.md)"/gm)];
  return {
    lastUrl: url.at(-1)?.replace(/["',}\]]+$/, '') ?? null,
    lastKind: (kind.at(-1)?.[1] as string) ?? null,
    lastPageId: pid.at(-1)?.[1] ?? null,
    lastJournalFile: jf.at(-1)?.[1] ?? null,
    noActivity: /no activity collected/i.test(all),
    summaryFailed: /summary generation failed|요약 생성 실패|summarizer threw/.test(all),
  };
}

function feedLines(lines: string[]) {
  const ext = createExtractor();
  for (const l of lines) ext.feed(l);
  return {
    lastUrl: ext.lastUrl,
    lastKind: ext.lastKind,
    lastPageId: ext.lastPageId,
    lastJournalFile: ext.lastJournalFile,
    noActivity: ext.noActivity,
    summaryFailed: ext.summaryFailed,
  };
}

const PID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const PID2 = 'ffffffffffffffffffffffffffffffff';

describe('createExtractor — 옛 전체 스캔과 등가', () => {
  const cases: string[][] = [
    [
      '[13:01:02] INFO: notion publish start',
      `{"kind":"created","pageId":"${PID}","url":"https://www.notion.so/${PID}"}`,
    ],
    [`{"kind":"skipped","pageId":"${PID}"}`, `{"kind":"created","pageId":"${PID2}"}`], // 마지막 매치 우선
    ['no activity collected — skipping'],
    ['summary generation failed', '요약 생성 실패'],
    [`{"msg":"journal write done","fileName":"2026-07-05.md"}`],
    [`{"fileName":"other.md"}`, `{"msg":"journal write done","fileName":"2026-07-06.md"}`],
    ['nothing interesting here', '[boot] Starting Nest application'],
  ];

  for (const [i, lines] of cases.entries()) {
    it(`case ${i}`, () => {
      expect(feedLines(lines)).toEqual(legacyScan(lines.join('\n')));
    });
  }

  it('journal write done 없는 fileName 은 추출 안 함 (옛 lookahead 등가)', () => {
    const lines = [`{"fileName":"stray.md"}`];
    const r = feedLines(lines);
    expect(r.lastJournalFile).toBeNull();
    expect(r).toEqual(legacyScan(lines.join('\n')));
  });
});
