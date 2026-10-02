type NestedKey = 'autoPublish' | 'prompts' | 'export' | 'graph' | 'backup';

// 설정 patch 병합 — 중첩 객체는 한 단계 깊게 합침 (main 저장·renderer 낙관 반영이 같은 규칙이어야 함)
export function mergeSettings<S extends Record<NestedKey, object>>(prev: S, patch: Partial<S>): S {
  return {
    ...prev,
    ...patch,
    autoPublish: { ...prev.autoPublish, ...(patch.autoPublish ?? {}) },
    prompts: { ...prev.prompts, ...(patch.prompts ?? {}) },
    export: { ...prev.export, ...(patch.export ?? {}) },
    graph: { ...prev.graph, ...(patch.graph ?? {}) },
    backup: { ...prev.backup, ...(patch.backup ?? {}) },
  };
}
