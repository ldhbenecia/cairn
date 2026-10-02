export type RunOutcome =
  | 'fail'
  | 'summaryFailed'
  | 'noActivity'
  | 'skipped'
  | 'noTarget'
  | 'localDone'
  | 'done';

type OutcomeInput = {
  ok: boolean;
  summaryFailed: boolean;
  noActivity: boolean;
  publishKind: 'created' | 'recreated' | 'skipped' | 'no-target' | null;
  journalFile: string | null;
  failureHint: string | null;
};

// 발행 결과 표시 분류의 단일 출처 — 알림·토스트·결과 화면이 같은 우선순위로 판정
// 구체 원인(failureHint)이 있으면 그 실패가 '요약 실패' 일반 문구보다 우선
export function classifyRunOutcome(r: OutcomeInput): RunOutcome {
  if (!r.ok && r.failureHint) return 'fail';
  if (r.summaryFailed) return 'summaryFailed';
  if (!r.ok) return 'fail';
  if (r.publishKind === 'no-target') return r.journalFile ? 'localDone' : 'noTarget';
  if (r.noActivity) return 'noActivity';
  if (r.publishKind === 'skipped') return 'skipped';
  return 'done';
}
