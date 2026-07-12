export type DeepLink = { action: 'capture'; text: string | null };

// capture/append 호스트만 화이트리스트 (외부 앱발 입력).
// text 는 자르지 않는다 — truncate 는 egress 패턴을 반토막 낼 수 있어 초과분은 memo-store 가 거부
export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'cairn:') return null;
  if (url.hostname !== 'capture' && url.hostname !== 'append') return null;
  const text = url.searchParams.get('text')?.trim() ?? '';
  return { action: 'capture', text: text.length > 0 ? text : null };
}
