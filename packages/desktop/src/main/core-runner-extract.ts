// core 자식 프로세스 stdout 에서 발행 결과를 추출하는 로직 — electron 무의존으로 분리해
// 단위 테스트 가능하게. 종료 시 stdoutAll 전체를 스캔하던 것을 라인 단위 증분으로 대체하며
// '마지막 매치 우선' 의미를 보존한다. (로그 한 라인 안에서 정규식이 완결되므로 전체 스캔과 등가)

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

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
  // 로컬 journal(1차 기록) 쓰기 실패 — 노션 발행이 성공해도 로컬 기록이 통째로 빠질 수 있어
  // 결과가 ok 라도 사용자에게 경고해야 한다 (예: macOS TCC 로 Documents 접근 거부 → EPERM)
  journalWriteFailed: boolean;
}

// core fork-IPC 구조화 이벤트 (ADR 0033) — 송신 타입: core/src/common/parent-events.ts (드리프트 주의)
export type ParentEvent =
  | { type: 'date-step'; date: string; step: 'collect' | 'summarize' | 'publish' }
  | {
      type: 'publish-result';
      kind: Exclude<PublishKind, null>;
      pageId: string | null;
      url: string | null;
    }
  | { type: 'journal-written'; fileName: string }
  | { type: 'journal-write-failed' }
  | { type: 'no-activity'; date: string }
  | { type: 'summary-failed'; date: string }
  | { type: 'backfill-start'; total: number; dates: string[] }
  | { type: 'backfill-date-start'; date: string }
  | {
      type: 'backfill-progress';
      done: number;
      total: number;
      doneDates: string[];
      failedDates: string[];
    }
  | { type: 'day-done'; date: string; pr: number; commit: number; pageId: string | null };

const PUBLISH_KINDS = new Set(['created', 'recreated', 'skipped', 'no-target']);
const STEPS = new Set(['collect', 'summarize', 'publish']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const dateList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((d) => typeof d === 'string' && ISO_DATE.test(d))
    ? (v as string[])
    : null;

export function parseParentEvent(raw: unknown): ParentEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.cairn !== 1 || typeof m.type !== 'string') return null;
  switch (m.type) {
    case 'date-step':
      return typeof m.date === 'string' && typeof m.step === 'string' && STEPS.has(m.step)
        ? { type: 'date-step', date: m.date, step: m.step as 'collect' | 'summarize' | 'publish' }
        : null;
    case 'publish-result':
      return typeof m.kind === 'string' && PUBLISH_KINDS.has(m.kind)
        ? {
            type: 'publish-result',
            kind: m.kind as Exclude<PublishKind, null>,
            pageId: typeof m.pageId === 'string' ? m.pageId : null,
            url: typeof m.url === 'string' ? m.url : null,
          }
        : null;
    case 'journal-written':
      return typeof m.fileName === 'string' && m.fileName.endsWith('.md')
        ? { type: 'journal-written', fileName: m.fileName }
        : null;
    case 'journal-write-failed':
      return { type: 'journal-write-failed' };
    case 'no-activity':
      return typeof m.date === 'string' ? { type: 'no-activity', date: m.date } : null;
    case 'summary-failed':
      return typeof m.date === 'string' ? { type: 'summary-failed', date: m.date } : null;
    case 'backfill-start': {
      const dates = dateList(m.dates);
      return isCount(m.total) && dates ? { type: 'backfill-start', total: m.total, dates } : null;
    }
    case 'backfill-date-start':
      return typeof m.date === 'string' && ISO_DATE.test(m.date)
        ? { type: 'backfill-date-start', date: m.date }
        : null;
    case 'backfill-progress': {
      const doneDates = dateList(m.doneDates);
      const failedDates = dateList(m.failedDates);
      return isCount(m.done) && isCount(m.total) && doneDates && failedDates
        ? { type: 'backfill-progress', done: m.done, total: m.total, doneDates, failedDates }
        : null;
    }
    case 'day-done':
      return typeof m.date === 'string' &&
        ISO_DATE.test(m.date) &&
        isCount(m.pr) &&
        isCount(m.commit)
        ? {
            type: 'day-done',
            date: m.date,
            pr: m.pr,
            commit: m.commit,
            pageId: typeof m.pageId === 'string' ? m.pageId : null,
          }
        : null;
    default:
      return null;
  }
}

export function applyParentEvent(state: RunExtractor, event: ParentEvent): RunStep | null {
  switch (event.type) {
    case 'date-step':
      return event.step;
    case 'publish-result':
      state.lastKind = event.kind;
      if (event.pageId) state.lastPageId = event.pageId;
      if (event.url) state.lastUrl = event.url;
      return null;
    case 'journal-written':
      state.lastJournalFile = event.fileName;
      return null;
    case 'journal-write-failed':
      state.journalWriteFailed = true;
      return null;
    case 'no-activity':
      state.noActivity = true;
      return null;
    case 'summary-failed':
      state.summaryFailed = true;
      return null;
    case 'backfill-start':
    case 'backfill-date-start':
    case 'backfill-progress':
    case 'day-done':
      // 배치 진행 상태는 core-runner-backfill.applyBackfillEvent 소유
      return null;
  }
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
    journalWriteFailed: false,
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
    // daily/rollup 둘 다 'journal write failed' 로그를 남긴다 (orchestrator)
    if (!state.journalWriteFailed && /journal write failed/.test(line)) {
      state.journalWriteFailed = true;
    }
    // 첫 매치 라인의 힌트 유지 — 옛 전체 스캔은 auth>quota>… 우선순위였으나 라인 순서로도 실용상 충분
    if (!state.failureHint) state.failureHint = deriveFailureHint(line);
  };
  return state;
}
