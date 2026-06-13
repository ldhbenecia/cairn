// 요약 모델 선택 — CAIRN_SUMMARY_MODEL env 로 Agent SDK 의 model 을 지정한다.
// 요약은 구조화된 활동을 한국어로 정리하는 단순 작업이라 기본을 sonnet 으로 둔다(속도).
// 'default' / 미지정 / 알 수 없는 값은 CLI 기본 모델을 그대로 쓴다(override 안 함).
const ALIASES = new Set(['sonnet', 'haiku', 'opus']);

export function summaryModelOption(): { model?: string } {
  const v = process.env.CAIRN_SUMMARY_MODEL?.trim().toLowerCase();
  return v && ALIASES.has(v) ? { model: v } : {};
}
