// 가로 드래그 리사이즈 — 드래그 중엔 DOM 폭만 바꾸고 놓을 때 한 번만 커밋 — mousemove 마다 리렌더 방지
// 반환값은 정리 함수 (드래그 중 언마운트 대비)
export function startColResize(
  el: HTMLElement,
  widthAt: (clientX: number) => number,
  commit: (width: number) => void,
): () => void {
  let last: number | null = null;
  const onMove = (ev: MouseEvent): void => {
    last = widthAt(ev.clientX);
    el.style.width = `${last}px`;
  };
  const cleanup = (): void => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.removeEventListener('blur', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  function onUp(): void {
    cleanup();
    if (last !== null) commit(last);
  }
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  // 창 밖에서 버튼을 놓으면 mouseup 이 안 와 blur 로도 종료
  window.addEventListener('blur', onUp);
  return cleanup;
}
