import type { CoreMode, CoreRunOptions } from '../shared/ipc-types';

export const CORE_MODES: readonly CoreMode[] = ['daily', 'weekly', 'monthly', 'yearly'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// 렌더러 인자는 신뢰 불가 — 모드는 거부, 옵션은 아는 필드만 타입이 맞을 때 통과 (값 범위는 core CLI 가 재검증)
export function parseRunRequest(mode: unknown, options: unknown): [CoreMode, CoreRunOptions] {
  if (!CORE_MODES.includes(mode as CoreMode)) throw new Error(`invalid mode: ${String(mode)}`);
  const o = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  const out: CoreRunOptions = {};
  if (Number.isInteger(o.backfillDays) && (o.backfillDays as number) >= 0) {
    out.backfillDays = o.backfillDays as number;
  }
  if (o.force === true) out.force = true;
  if (typeof o.date === 'string' && ISO_DATE.test(o.date)) out.date = o.date;
  if (o.skipNotion === true) out.skipNotion = true;
  return [mode as CoreMode, out];
}
