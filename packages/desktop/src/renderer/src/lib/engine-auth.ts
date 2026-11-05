import { useCallback, useEffect, useState } from 'react';
import type { SummaryProvider } from '../../../shared/ipc-types';

// 쓰지 않는 엔진은 모델 호출 probe 대신 로그인 여부만 — 보일 때(enabled)만 확인해 사용량·fork 를 아낌
export function useEngineLoggedIn(
  provider: SummaryProvider,
  enabled: boolean,
): { loggedIn: boolean | null; refresh: () => void } {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const refresh = useCallback(() => {
    setLoggedIn(null);
    void window.cairn.engine
      .loggedIn(provider)
      .then(setLoggedIn)
      .catch(() => setLoggedIn(false));
  }, [provider]);
  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);
  return { loggedIn, refresh };
}
