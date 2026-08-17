import { useEffect, useState } from 'react';
import type { CloudAuthState } from './cairn-api';

// ready: 초기 state() 응답(또는 첫 이벤트)이 도착했는지 — 플랜 기반 UI 게이트가
// 로딩 중 기본값(free)으로 오동작하지 않게 소비처에서 확정 전 판단을 미룰 수 있다
export function useCloudAuth(): CloudAuthState & { ready: boolean } {
  const [state, setState] = useState<CloudAuthState>({ signedIn: false, user: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 리스너를 먼저 등록하고, 초기 state() 가 이벤트보다 늦게 와도 최신 상태를 덮어쓰지 않게 가드
    let eventArrived = false;
    const off = window.cairn.cloud.onChanged((s) => {
      eventArrived = true;
      setState(s);
      setReady(true);
    });
    void window.cairn.cloud
      .state()
      .then((s) => {
        if (!eventArrived) setState(s);
        setReady(true);
      })
      .catch(() => setReady(true));
    return off;
  }, []);

  return { ...state, ready };
}
