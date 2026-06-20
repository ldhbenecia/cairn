import { useEffect, useState } from 'react';
import type { CloudAuthState } from './cairn-api';

export function useCloudAuth(): CloudAuthState {
  const [state, setState] = useState<CloudAuthState>({ signedIn: false, user: null });

  useEffect(() => {
    void window.cairn.cloud.state().then(setState);
    return window.cairn.cloud.onChanged(setState);
  }, []);

  return state;
}
