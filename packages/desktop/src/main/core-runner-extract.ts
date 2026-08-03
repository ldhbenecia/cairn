// core 자식 프로세스 실행 결과 계약 — fork-IPC 구조화 이벤트가 단일 소스 (ADR 0033 3단계,
// 로그 스크래핑 제거). stdout 은 failureHint(자유 에러 텍스트 분류)만 본다 — 이벤트로 옮기기엔
// 에러 원문이 다양해 텍스트 패턴 분류가 남은 마지막 용도. electron 무의존이라 단위 테스트 가능

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

export type FailureHint =
  | 'auth'
  | 'claude-auth'
  | 'quota'
  | 'summarize'
  | 'network'
  | 'notion'
  | 'collect'
  | null;

// 실패 원인 힌트 — raw 로그는 UI 비노출 정책이라 대표 패턴만 내부 분류해 친화 문구 키로 전달.
// 어떤 패턴에도 안 걸리면 null
export function deriveFailureHint(text: string): FailureHint {
  if (/OAuth token.*(expired|revoked)|Please run \/login|authentication_error/i.test(text))
    return 'claude-auth';
  if (/auth_failed|Bad credentials|Missing required secret|"status"\s*:\s*401/i.test(text))
    return 'auth';
  if (/rate_limited|session limit|quota|"status"\s*:\s*429/i.test(text)) return 'quota';
  if (/rollup: summary generation failed|롤업 요약 생성 실패/i.test(text)) return 'summarize';
  if (/validation_error|body failed validation/i.test(text)) return 'notion';
  if (/collect errors — failing|수집 실패/i.test(text)) return 'collect';
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|fetch failed/i.test(text)) return 'network';
  return null;
}

// 구체 원인이 일반 증상을 이긴다 — 예: "fetch failed"(network) 경고 뒤 "Bad credentials"(auth) 가
// 와도 auth 로 분류. 같은 순위면 첫 매치 유지
const HINT_PRIORITY: Record<Exclude<FailureHint, null>, number> = {
  'claude-auth': 7,
  auth: 6,
  quota: 5,
  summarize: 4,
  notion: 3,
  collect: 2,
  network: 1,
};

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
  // 부분 수집 실패(계정/레포 일부만) — 성공 발행이어도 그 소스 활동이 빠졌음을 경고
  collectPartialLabels: string[];
}

// core fork-IPC 이벤트 (ADR 0033) — 송신 타입: core/src/common/parent-events.ts
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
  | { type: 'day-done'; date: string; pr: number; commit: number; pageId: string | null }
  | { type: 'collect-partial'; labels: string[] };

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
    case 'collect-partial': {
      const labels =
        Array.isArray(m.labels) && m.labels.every((l) => typeof l === 'string') ? m.labels : null;
      return labels ? { type: 'collect-partial', labels } : null;
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
    case 'collect-partial':
      state.collectPartialLabels = [...new Set([...state.collectPartialLabels, ...event.labels])];
      return null;
    case 'backfill-start':
    case 'backfill-date-start':
    case 'backfill-progress':
    case 'day-done':
      // 배치 진행은 applyBackfillEvent 소유
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
    collectPartialLabels: [],
  };
  // 결과 필드(url·kind·pageId·journal·noActivity·summaryFailed)는 applyParentEvent 가 채운다 —
  // stdout 은 failureHint 분류만. HINT_PRIORITY 로 더 구체적인 원인이 나오면 갱신
  state.feed = (line: string): void => {
    const hint = deriveFailureHint(line);
    if (!hint) return;
    if (!state.failureHint || HINT_PRIORITY[hint] > HINT_PRIORITY[state.failureHint]) {
      state.failureHint = hint;
    }
  };
  return state;
}
