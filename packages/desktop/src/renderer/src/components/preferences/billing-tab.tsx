import { Check } from 'lucide-react';
import type { I18nKey } from '../../i18n';
import { useSettings } from '../../settings-context';
import { Field } from './field';

const PRO_FEATURES: I18nKey[] = [
  'billing.pro.f1',
  'billing.pro.f2',
  'billing.pro.f3',
  'billing.pro.f4',
  'billing.pro.f5',
  'billing.pro.f6',
];

export function BillingTab() {
  const { t } = useSettings();
  return (
    <div>
      <Field label={t('prefs.billing')} desc={t('billing.lead')}>
        <span />
      </Field>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-hairline bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-ink">Free</p>
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10.5px] font-medium text-accent-hover">
              {t('billing.current')}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-tertiary">
            {t('billing.free.desc')}
          </p>
        </div>

        <div className="rounded-lg border border-hairline bg-surface-1 p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-semibold text-ink">Pro</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] leading-none font-semibold tracking-[-0.5px] text-ink tabular-nums">
                $29
              </span>
              <span className="text-[11.5px] text-ink-tertiary">{t('billing.pro.note')}</span>
            </p>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-[12.5px] leading-snug text-ink-muted">
            {PRO_FEATURES.map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Check size={12} strokeWidth={2.5} className="mt-0.5 shrink-0 text-accent-hover" />
                {t(k)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-5 rounded-full border border-hairline-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-tertiary opacity-70"
          >
            {t('billing.checkoutSoon')}
          </button>
          <div className="mt-4 border-t border-hairline pt-4">
            <p className="text-[12px] text-ink-muted">{t('billing.licenseKey')}</p>
            <input
              disabled
              placeholder={t('billing.licenseSoon')}
              className="mt-2 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-tertiary disabled:opacity-60"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
