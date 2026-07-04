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

// ADR 0021 item-drop: children 블록을 개별 검사해 위반 블록만(중첩 children 포함 통째) drop.
// 자유텍스트엔 마스킹 금지 — 완화 수단은 drop 뿐. 생존 셋엔 통짜 검사를 한 번 더(교차 블록 패턴
// 백스톱), 전부 drop 이거나 백스톱에 걸리면 fallback 으로 degrade, fallback 도 걸리면 throw.
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
      // 블록 내용은 절대 로그하지 않는다(금지 페이로드 자체일 수 있음) — 패턴명(err)·index·type 만
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
