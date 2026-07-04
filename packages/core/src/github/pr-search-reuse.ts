// backfill PR 검색 캐시 재사용 판정 (순수 로직 — github-api.client 의 searchPrsUpdatedSince 가 사용)
//
// 재사용 정당성 (updated-desc 정렬 + 1000 cap 전제):
// - 캐시 lower bound L1 <= 요청 L2 이면 항상 서빙 가능.
// - truncated 아님 → updated_at >= L2 필터가 완전한 결과.
// - truncated 여도 안전: 누락된 항목은 전부 마지막(가장 오래된) 반환 항목 이하의 updated_at.
//   L2 > oldest 면 필터 결과 완전. L2 <= oldest 면 필터 결과 == 캐시 1000 건 전부인데,
//   신규 `updated:>=L2` 검색도 같은 desc top-1000 을 돌려주므로 재검색과 결과 동일 — 이득 없음.

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

// slice 가 증명 가능하게 완전한지 (false 여도 신규 검색 결과와 동일 — 로그용 정보)
export function isPrSliceComplete(
  truncated: boolean,
  oldestUpdatedAtIso: string | undefined,
  requestedLowerBoundIso: string,
): boolean {
  if (!truncated || oldestUpdatedAtIso === undefined) return true;
  return Date.parse(requestedLowerBoundIso) > Date.parse(oldestUpdatedAtIso);
}
