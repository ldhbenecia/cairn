import { useSyncExternalStore } from 'react';
import type { CoreMode, RunLine } from '../../../shared/ipc-types';

const TAIL_MAX = 200;

// 라인 버퍼는 React state 밖 모듈 싱글턴 — 라인마다 앱 전체 리렌더 방지, 다이얼로그 unmount 에도 유지
const buffers: Record<CoreMode, RunLine[]> = { daily: [], weekly: [], monthly: [], yearly: [] };
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((fn) => fn());

// main 이 100ms 단위로 묶어 보냄 — 묶음당 한 번만 복사·통지
window.cairn.onRunLines((lines) => {
  for (const mode of new Set(lines.map((l) => l.mode))) {
    const merged = [...buffers[mode], ...lines.filter((l) => l.mode === mode)];
    buffers[mode] = merged.length > TAIL_MAX ? merged.slice(-TAIL_MAX) : merged;
  }
  emit();
});

export function resetRunLines(mode: CoreMode): void {
  if (buffers[mode].length === 0) return;
  buffers[mode] = [];
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useRunLines(mode: CoreMode): RunLine[] {
  return useSyncExternalStore(subscribe, () => buffers[mode]);
}
