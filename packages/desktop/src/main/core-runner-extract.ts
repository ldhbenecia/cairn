// core 자식 프로세스 stdout 에서 발행 결과를 추출하는 로직 — electron 무의존으로 분리해
// 단위 테스트 가능하게. 종료 시 stdoutAll 전체를 스캔하던 것을 라인 단위 증분으로 대체하며
// '마지막 매치 우선' 의미를 보존한다. (로그 한 라인 안에서 정규식이 완결되므로 전체 스캔과 등가)

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export const NO_ACTIVITY_REGEX = /no activity collected/i;
export const SUMMARY_FAILED_REGEX = /summary generation failed|요약 생성 실패|summarizer threw/;

export interface RunExtractor {
  feed: (line: string) => void;
  lastUrl: string | null;
  lastKind: PublishKind;
  lastPageId: string | null;
  lastJournalFile: string | null;
  noActivity: boolean;
  summaryFailed: boolean;
}

export function createExtractor(): RunExtractor {
  const state: RunExtractor = {
    feed: () => {},
    lastUrl: null,
    lastKind: null,
    lastPageId: null,
    lastJournalFile: null,
    noActivity: false,
    summaryFailed: false,
  };
  const lineUrl = /https:\/\/www\.notion\.so\/\S+/g;
  const lineKind = /"kind"\s*:\s*"(created|recreated|skipped|no-target)"/g;
  const linePageId = /"pageId"\s*:\s*"([0-9a-f-]{32,36})"/g;
  const lineFileName = /"fileName"\s*:\s*"([^"]+\.md)"/;
  state.feed = (line: string): void => {
    const urls = line.match(lineUrl);
    if (urls) state.lastUrl = urls[urls.length - 1]!.replace(/["',}\]]+$/, '');
    const kinds = [...line.matchAll(lineKind)];
    if (kinds.length) state.lastKind = kinds[kinds.length - 1]![1] as PublishKind;
    const pageIds = [...line.matchAll(linePageId)];
    if (pageIds.length) state.lastPageId = pageIds[pageIds.length - 1]![1] ?? null;
    if (/journal write done/.test(line)) {
      const m = lineFileName.exec(line);
      if (m) state.lastJournalFile = m[1] ?? null;
    }
    if (!state.noActivity && NO_ACTIVITY_REGEX.test(line)) state.noActivity = true;
    if (!state.summaryFailed && SUMMARY_FAILED_REGEX.test(line)) state.summaryFailed = true;
  };
  return state;
}
