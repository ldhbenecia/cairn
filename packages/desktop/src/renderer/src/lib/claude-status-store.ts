import { useSyncExternalStore } from 'react';

export type ClaudeStatus = 'checking' | 'ok' | 'fail';

// probe 는 코어 fork + 실제 쿼리(최대 ~1분)라 사이드바·연결 탭이 결과 하나를 공유하고 동시 요청은 합침
let status: ClaudeStatus = 'checking';
let probed = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: ClaudeStatus): void {
  status = next;
  listeners.forEach((fn) => fn());
}

export function probeClaude(): Promise<void> {
  inflight ??= (async () => {
    set('checking');
    try {
      const r = await window.cairn.onboarding.probeClaude();
      set(r.ok ? 'ok' : 'fail');
    } catch {
      set('fail');
    } finally {
      probed = true;
      inflight = null;
    }
  })();
  return inflight;
}

export function probeClaudeOnce(): void {
  if (!probed) void probeClaude();
}

// 시작 시 1회 + 주기 확인 — 창이 숨겨진 트레이 상주 중엔 fork·실제 쿼리를 건너뛰고, 다시 보이면 놓친 확인을 즉시 실행
export function keepClaudeStatusFresh(intervalMs: number): () => void {
  let missed = false;
  const tick = (): void => {
    if (document.hidden) {
      missed = true;
      return;
    }
    missed = false;
    void probeClaude();
  };
  const onVisibility = (): void => {
    if (!document.hidden && missed) tick();
  };
  void probeClaude();
  const id = setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

// 요약 실패는 세션 만료·쿼터의 가장 직접적인 신호 — 직전 probe 성공을 믿지 않고 즉시 재확인
window.cairn.onRunDone(({ result }) => {
  if (
    result.summaryFailed ||
    result.failureHint === 'claude-auth' ||
    result.failureHint === 'quota'
  ) {
    void probeClaude();
  }
});

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useClaudeStatus(): ClaudeStatus {
  return useSyncExternalStore(subscribe, () => status);
}
