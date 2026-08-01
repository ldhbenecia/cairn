import { useEffect, useState } from 'react';
import { useSettings } from '../settings-context';
import { useCloudAuth } from '../use-cloud-auth';
import { useOnline } from '../use-online';

export function AccountStatusPill({ className = '' }: { className?: string }) {
  const { t } = useSettings();
  const { signedIn } = useCloudAuth();
  const online = useOnline();
  const [expired, setExpired] = useState(false);

  // 저장 파일 존재만으론 만료를 못 본다 — 세션 실검증으로 '로그인됨인데 sync 죽음' 상태 노출
  useEffect(() => {
    if (!signedIn || !online) {
      setExpired(false);
      return;
    }
    let alive = true;
    void window.cairn.cloud
      .validate()
      .then((h) => {
        if (alive) setExpired(h === 'expired');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn, online]);

  const state = !signedIn ? 'local' : expired ? 'expired' : online ? 'cloud' : 'offline';
  const tone = {
    cloud: 'bg-surface-2 text-ink-muted',
    offline: 'bg-warning/15 text-warning',
    expired: 'bg-warning/15 text-warning',
    local: 'bg-surface-2 text-ink-tertiary',
  }[state];
  const label = {
    cloud: t('account.cloud'),
    offline: t('account.offline'),
    expired: t('account.expired'),
    local: t('account.local'),
  }[state];

  if (state === 'expired') {
    return (
      <button
        type="button"
        onClick={() => void window.cairn.cloud.signIn().catch(() => {})}
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-warning/25 ${tone} ${className}`}
      >
        {label}
      </button>
    );
  }
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
