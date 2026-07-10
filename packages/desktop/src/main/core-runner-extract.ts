// core 자식 프로세스 stdout 에서 발행 결과를 추출하는 로직 — electron 무의존으로 분리해
// 단위 테스트 가능하게. 종료 시 stdoutAll 전체를 스캔하던 것을 라인 단위 증분으로 대체하며
// '마지막 매치 우선' 의미를 보존한다. (로그 한 라인 안에서 정규식이 완결되므로 전체 스캔과 등가)

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type FailureHint = 'auth' | 'quota' | 'network' | 'notion' | 'collect' | null;

export const NO_ACTIVITY_REGEX = /no activity collected/i;
export const SUMMARY_FAILED_REGEX = /summary generation failed|요약 생성 실패|summarizer threw/;

// 실패 원인 힌트 — raw 로그는 UI 비노출 정책이라 대표 패턴만 내부 분류해 친화 문구 키로 전달.
// 어떤 패턴에도 안 걸리면 null (기존 exit code 표기 유지)
export function deriveFailureHint(text: string): FailureHint {
  if (/auth_failed|Bad credentials|Missing required secret|"status"\s*:\s*401/i.test(text))
    return 'auth';
  if (/rate_limited|session limit|quota|"status"\s*:\s*429/i.test(text)) return 'quota';
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|fetch failed/i.test(text)) return 'network';
  if (/validation_error|body failed validation/i.test(text)) return 'notion';
  if (/collect errors — failing|수집 실패/i.test(text)) return 'collect';
  return null;
}

export interface RunExtractor {
  feed: (line: string) => void;
  lastUrl: string | null;
  lastKind: PublishKind;
  lastPageId: string | null;
  lastJournalFile: string | null;
  noActivity: boolean;
  summaryFailed: boolean;
  failureHint: FailureHint;
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
    failureHint: null,
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
    // 첫 매치 라인의 힌트 유지 — 옛 전체 스캔은 auth>quota>… 우선순위였으나 라인 순서로도 실용상 충분
    if (!state.failureHint) state.failureHint = deriveFailureHint(line);
  };
  return state;
}
