import { CreditCard } from 'lucide-react';
import { useSettings } from '../../settings-context';

export function BillingTab() {
  const { t } = useSettings();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
      <CreditCard size={26} strokeWidth={1.5} className="text-ink-tertiary" />
      <p className="text-[14px] font-medium text-ink-muted">{t('prefs.billing.soon')}</p>
      <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.billing.desc')}</p>
    </div>
  );
}
