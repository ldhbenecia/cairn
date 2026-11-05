// 펼침·접힘 같은 키 집합 토글 — setState 업데이터에서 쓰도록 새 Set 반환
export function toggleIn<T>(set: ReadonlySet<T>, key: T): Set<T> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
