import { useEffect, useState } from 'react';
import type { CloudAuthState } from './cairn-api';

export function useCloudAuth(): CloudAuthState {
  const [state, setState] = useState<CloudAuthState>({ signedIn: false, user: null });

  useEffect(() => {
    // 리스너를 먼저 등록하고, 초기 state() 가 이벤트보다 늦게 와도 최신 상태를 덮어쓰지 않게 가드
    let eventArrived = false;
    const off = window.cairn.cloud.onChanged((s) => {
      eventArrived = true;
      setState(s);
    });
    void window.cairn.cloud
      .state()
      .then((s) => {
        if (!eventArrived) setState(s);
      })
      .catch(() => {});
    return off;
  }, []);

  return state;
}
