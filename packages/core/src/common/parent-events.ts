// desktop fork(ipc) 전용 이벤트 (ADR 0033) — CLI 단독 실행은 no-op
// 소비 측: packages/desktop/src/main/core-runner-extract.ts

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

export function emitParentEvent(event: ParentEvent): void {
  if (typeof process.send !== 'function') return;
  try {
    process.send({ cairn: 1, ...event });
  } catch {
    /* best-effort — 스크래핑 폴백 */
  }
}
