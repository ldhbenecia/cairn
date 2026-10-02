import { useEffect, useRef } from 'react';

type EscapeOptions = {
  enabled?: boolean;
  target?: 'window' | 'document';
  capture?: boolean; // 다른 리스너(Radix·상위 오버레이)보다 먼저 받기
  stop?: boolean; // 소비한 ESC 가 상위 오버레이까지 닫지 않게 전파 차단
  prevent?: boolean;
  skipWhenDialogOpen?: boolean; // 위에 다이얼로그가 떠 있으면 그쪽 ESC 가 우선
};

// ESC 닫기 — IME 조합 취소 ESC(isComposing·keyCode 229)는 닫기가 아님
export function useEscape(onEscape: () => void, opts: EscapeOptions = {}): void {
  const {
    enabled = true,
    target = 'window',
    capture = false,
    stop,
    prevent,
    skipWhenDialogOpen,
  } = opts;
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!enabled) return;
    const node = target === 'document' ? document : window;
    const onKey = (e: Event): void => {
      const k = e as KeyboardEvent;
      if (k.key !== 'Escape' || k.isComposing || k.keyCode === 229) return;
      if (skipWhenDialogOpen && document.querySelector('[role="dialog"]')) return;
      if (prevent) k.preventDefault();
      if (stop) k.stopPropagation();
      handler.current();
    };
    node.addEventListener('keydown', onKey, capture);
    return () => node.removeEventListener('keydown', onKey, capture);
  }, [enabled, target, capture, stop, prevent, skipWhenDialogOpen]);
}
