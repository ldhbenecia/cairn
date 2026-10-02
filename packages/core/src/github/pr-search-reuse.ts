// backfill PR 검색 캐시 재사용 판정 — updated-desc 정렬 + 1000 cap 전제
// 캐시 lower bound L1 <= 요청 L2 면 항상 서빙 가능, truncated 아니면 updated_at >= L2 필터가 완전함
// truncated 여도 누락분은 전부 가장 오래된 반환 항목 이하라 L2 > oldest 면 완전,
// L2 <= oldest 면 결과가 캐시 1000건 전부로 재검색 결과(같은 desc top-1000)와 동일

export function canReusePrSearch(
  cachedLowerBoundIso: string,
  requestedLowerBoundIso: string,
): boolean {
  return Date.parse(requestedLowerBoundIso) >= Date.parse(cachedLowerBoundIso);
}

export function sliceUpdatedSince<T extends { updatedAt: string }>(
  items: readonly T[],
  lowerBoundIso: string,
): T[] {
  const since = Date.parse(lowerBoundIso);
  return items.filter((i) => Date.parse(i.updatedAt) >= since);
}

// false 여도 신규 검색 결과와 동일 — 로그용 정보
export function isPrSliceComplete(
  truncated: boolean,
  oldestUpdatedAtIso: string | undefined,
  requestedLowerBoundIso: string,
): boolean {
  if (!truncated || oldestUpdatedAtIso === undefined) return true;
  return Date.parse(requestedLowerBoundIso) > Date.parse(oldestUpdatedAtIso);
}
