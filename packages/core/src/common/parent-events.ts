// desktop 이 fork(ipc) 로 실행할 때만 존재하는 process.send 로 구조화 이벤트를 보낸다 (ADR 0033).
// 로그 스크래핑 계약의 1차 대체 — CLI 단독 실행에선 조용히 no-op.
// 필드는 화이트리스트 성격만: kind·date·counts·journal fileName(경로 아님)·Notion pageId/url.
// desktop 쪽 소비 타입: packages/desktop/src/main/core-runner-extract.ts (드리프트 주의)

export type ParentEvent =
  | { type: 'date-step'; date: string; step: 'collect' | 'summarize' | 'publish' }
  | {
      type: 'publish-result';
      kind: 'created' | 'recreated' | 'skipped' | 'no-target';
      pageId: string | null;
      url: string | null;
    }
  | { type: 'journal-written'; fileName: string }
  | { type: 'journal-write-failed' }
  | { type: 'no-activity'; date: string }
  | { type: 'summary-failed'; date: string };

export function emitParentEvent(event: ParentEvent): void {
  if (typeof process.send !== 'function') return;
  try {
    process.send({ cairn: 1, ...event });
  } catch {
    // 채널 닫힘 등 — best-effort, desktop 은 로그 스크래핑 폴백을 가진다
  }
}
