import { useSyncExternalStore } from 'react';
import type { SummaryProvider } from '../../../shared/ipc-types';

export type ClaudeStatus = 'checking' | 'ok' | 'fail';

// probe 는 코어 fork + 실제 쿼리(최대 ~1분)라 사이드바·연결 탭이 결과 하나를 공유하고 동시 요청은 합침
// 엔진별로 보관 — 확인 도중 엔진을 바꾸면 이전 엔진 결과가 새 엔진 이름으로 표시되던 경합 방지
const results: Partial<Record<SummaryProvider, ClaudeStatus>> = {};
const inflight: Partial<Record<SummaryProvider, Promise<void>>> = {};
let active: SummaryProvider = 'claude';
let probed = false;
let busy = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function set(provider: SummaryProvider, next: ClaudeStatus): void {
  results[provider] = next;
  emit();
}

export function setActiveEngine(provider: SummaryProvider): void {
  if (active === provider) return;
  active = provider;
  emit();
}

// main 은 fork 시점 설정의 provider 로 확인 — 호출 시점의 사용 중 엔진에 결과를 기록
export function probeClaude(): Promise<void> {
  const provider = active;
  inflight[provider] ??= (async () => {
    set(provider, 'checking');
    try {
      const r = await window.cairn.onboarding.probeClaude();
      set(provider, r.ok ? 'ok' : 'fail');
    } catch {
      set(provider, 'fail');
    } finally {
      probed = true;
      delete inflight[provider];
    }
  })();
  return inflight[provider];
}

export function probeClaudeOnce(): void {
  if (!probed) void probeClaude();
}

// 시작 시 1회 + 주기 확인 — 창이 숨겨진 트레이 상주 중엔 fork·실제 쿼리를 건너뛰고, 다시 보이면 놓친 확인을 즉시 실행
export function keepClaudeStatusFresh(intervalMs: number): () => void {
  let missed = false;
  const tick = (): void => {
    // 발행 중엔 건너뜀 — 실패하면 run-done 에서 바로 재확인하고, 성공이면 엔진이 동작한다는 뜻
    if (busy) return;
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

window.cairn.onBusy((b) => (busy = b.busy));
void window.cairn.busyState().then((b) => (busy = b.busy));

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useClaudeStatus(): ClaudeStatus {
  return useSyncExternalStore(subscribe, () => results[active] ?? 'checking');
}
