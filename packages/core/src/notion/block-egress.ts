import { assertNoForbiddenPayload } from '../common/sanitize.js';

interface WarnLogger {
  warn(obj: unknown, msg?: string): void;
}

function blockTypeOf(block: unknown): string {
  if (block && typeof block === 'object' && 'type' in block) {
    const t = (block as { type?: unknown }).type;
    if (typeof t === 'string') return t;
  }
  return 'unknown';
}

// children 블록을 개별 검사해 위반 블록만(중첩 children 포함) drop — 자유텍스트엔 마스킹 금지
// 생존 셋은 통짜로 한 번 더 검사(교차 블록 패턴), 전부 drop·백스톱 걸림이면 fallback, fallback 도 걸리면 throw
export function enforceBlockEgress(
  blocks: readonly unknown[],
  buildFallback: () => readonly unknown[],
  label: string,
  logger: WarnLogger,
): readonly unknown[] {
  const kept: unknown[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    try {
      assertNoForbiddenPayload(block, `${label}.block`);
      kept.push(block);
    } catch (err) {
      // 블록 내용은 로그 금지(금지 페이로드 자체일 수 있음) — 패턴명·index·type 만
      logger.warn(
        { label, index, blockType: blockTypeOf(block), err: String(err) },
        'block tripped forbidden pattern — dropped',
      );
    }
  }

  if (kept.length > 0) {
    try {
      assertNoForbiddenPayload(kept, label);
      return kept;
    } catch (err) {
      logger.warn(
        { label, err: String(err) },
        'surviving blocks tripped forbidden pattern — degrading to fallback',
      );
    }
  } else {
    logger.warn({ label }, 'every block tripped forbidden pattern — degrading to fallback');
  }

  const fallback = buildFallback();
  try {
    assertNoForbiddenPayload(fallback, `${label}.fallback`);
  } catch (fallbackErr) {
    // fallback 도 걸리면 외부 송신을 막기 위해 발행 중단
    logger.warn(
      { label, err: String(fallbackErr) },
      'fallback blocks also tripped forbidden pattern — aborting publish',
    );
    throw new Error(`${label}: fallback also tripped forbidden pattern`, { cause: fallbackErr });
  }
  return fallback;
}
