import { useSettings } from '../settings-context';
import { useCloudAuth } from '../use-cloud-auth';
import { useOnline } from '../use-online';

export function AccountStatusPill({ className = '' }: { className?: string }) {
  const { t } = useSettings();
  const { signedIn } = useCloudAuth();
  const online = useOnline();

  const state = !signedIn ? 'local' : online ? 'cloud' : 'offline';
  const tone = {
    cloud: 'bg-accent/15 text-accent',
    offline: 'bg-amber-500/15 text-amber-400',
    local: 'bg-surface-2 text-ink-tertiary',
  }[state];
  const label = {
    cloud: t('account.cloud'),
    offline: t('account.offline'),
    local: t('account.local'),
  }[state];

  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
