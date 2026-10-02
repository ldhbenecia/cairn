// 같은 라벨은 제자리 교체(순서 유지), 신규만 끝에 추가 — 발행 대상이 첫 워크스페이스라 순서가 바뀌면 오발행
export function upsertByLabel<T extends { label?: string }, U>(
  prev: readonly T[],
  item: U,
  label: string,
): (T | U)[] {
  const idx = prev.findIndex((p) => p?.label === label);
  return idx === -1 ? [...prev, item] : prev.map((p, i) => (i === idx ? item : p));
}

// 온보딩 재실행의 빈 payload 는 '변경 없음' — UI 가 프리필 안 해서 기존 연결 무경고 삭제 방지
export function keepIfEmpty<T>(next: readonly T[], prev: readonly T[]): readonly T[] {
  return next.length ? next : prev;
}
