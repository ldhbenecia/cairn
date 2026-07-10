// 온보딩/연결 설정 병합의 순수 로직 — electron 의존 없이 단위 테스트 가능하게 분리

// 같은 라벨은 제자리 교체(순서 유지), 신규만 끝에 추가 — 발행 대상이 '첫 워크스페이스'라
// 순서가 바뀌면 오발행. label 매칭 upsert
export function upsertByLabel<T extends { label?: string }, U>(
  prev: readonly T[],
  item: U,
  label: string,
): (T | U)[] {
  const idx = prev.findIndex((p) => p?.label === label);
  return idx === -1 ? [...prev, item] : prev.map((p, i) => (i === idx ? item : p));
}

// 온보딩 재실행에서 빈 payload 는 '변경 없음' — 기존 연결 보존 (UI 가 프리필 안 하므로 무경고 삭제 방지)
export function keepIfEmpty<T>(next: readonly T[], prev: readonly T[]): readonly T[] {
  return next.length ? next : prev;
}
