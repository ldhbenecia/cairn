export type DeepLink = { action: 'capture'; text: string | null };

// cairn:// 딥링크 파싱 — capture/append 호스트만 화이트리스트 (외부 앱발 입력이라 그 외 명령은 무시).
// text 는 자르지 않고 그대로 — truncate 는 토큰·이메일을 반토막 내 egress 패턴 매칭을 피해갈 수 있어
// 상한 초과는 memo-store 가 거부하고 알림으로 알린다
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
