// 요약 모델 선택 — CAIRN_SUMMARY_MODEL env 로 Agent SDK 의 model 을 지정한다.
// 요약은 구조화된 활동을 한국어로 정리하는 단순 작업이라 기본을 sonnet 으로 둔다(속도).
// 'default' / 미지정 / 알 수 없는 값은 CLI 기본 모델을 그대로 쓴다(override 안 함).
//
// fallbackModel: 선택 모델이 overload/unavailable 일 때 떨어뜨릴 모델. cairn 은 "매일 흔적
// 하나씩" 이 핵심이라, 일시적 overload 로 그날 일지가 통째로 빠지지 않게 한다(streak 보호).
const FALLBACK: Record<string, string> = {
  sonnet: 'opus',
  haiku: 'sonnet',
  opus: 'sonnet',
};

export function summaryModelOption(): { model?: string; fallbackModel?: string } {
  const v = process.env.CAIRN_SUMMARY_MODEL?.trim().toLowerCase();
  if (!v || !(v in FALLBACK)) return {};
  return { model: v, fallbackModel: FALLBACK[v] };
}
