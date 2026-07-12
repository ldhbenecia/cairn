export type DeepLink = { action: 'capture'; text: string | null };

// capture/append 호스트만 화이트리스트
// text truncate 금지 — egress 패턴 반토막 방지, 초과분은 memo-store 가 거부
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
