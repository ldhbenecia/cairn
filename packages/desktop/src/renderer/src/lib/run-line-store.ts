import { useSyncExternalStore } from 'react';
import type { CoreMode, RunLine } from '../cairn-api';

const TAIL_MAX = 200;

// 라인 버퍼는 React state 밖 모듈 싱글턴 — 라인마다 앱 전체 리렌더 방지, 다이얼로그 unmount 에도 유지
const buffers: Record<CoreMode, RunLine[]> = { daily: [], weekly: [], monthly: [], yearly: [] };
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((fn) => fn());

window.cairn.onRunLine((l) => {
  const buf = buffers[l.mode];
  buffers[l.mode] = buf.length >= TAIL_MAX ? [...buf.slice(1), l] : [...buf, l];
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
