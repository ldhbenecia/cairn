import { Check } from 'lucide-react';
import type { I18nKey } from '../../i18n';
import { useSettings } from '../../settings-context';

const FREE_FEATURES: I18nKey[] = [
  'billing.free.f1',
  'billing.free.f2',
  'billing.free.f3',
  'billing.free.f4',
  'billing.free.f5',
];

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-hairline bg-surface-1 p-4 transition-colors hover:border-hairline-strong">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-[14.5px] font-semibold text-ink">Free</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-tertiary">
                {t('billing.free.desc')}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium tracking-wide text-ink-muted uppercase">
              {t('billing.current')}
            </span>
          </div>
          <p className="mb-4 flex items-baseline gap-1.5">
            <span className="text-[24px] leading-none font-semibold tracking-[-1px] text-ink">
              $0
            </span>
            <span className="text-[12px] font-medium text-ink-tertiary">
              {t('billing.free.note')}
            </span>
          </p>
          <div className="mb-4 h-px w-full bg-hairline" />
          <ul className="flex flex-col gap-2.5 text-[12.5px] leading-snug text-ink-muted">
            {FREE_FEATURES.map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <Check size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-ink-tertiary" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-xl border border-hairline-strong bg-surface-1 p-4">
          <span className="absolute inset-x-0 top-0 h-px bg-accent" />
          <div className="mb-4">
            <h3 className="text-[14.5px] font-semibold text-ink">Pro</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-tertiary">
              {t('billing.pro.desc')}
            </p>
          </div>
          <p className="mb-4 flex items-baseline gap-1.5">
            <span className="text-[24px] leading-none font-semibold tracking-[-1px] text-ink">
              $29
            </span>
            <span className="text-[12px] font-medium text-ink-tertiary">
              {t('billing.pro.note')}
            </span>
          </p>
          <button
            type="button"
            disabled
            className="mb-4 flex h-8 w-full items-center justify-center rounded-md bg-accent text-[13px] font-medium text-white opacity-55"
          >
            {t('billing.checkoutSoon')}
          </button>
          <div className="mb-4 h-px w-full bg-hairline" />
          <ul className="flex flex-col gap-2.5 text-[12.5px] leading-snug text-ink-muted">
            {PRO_FEATURES.map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <Check size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-ink-tertiary" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-[12px] text-ink-tertiary">
        <span className="size-1.5 rounded-full bg-surface-3" />
        {t('billing.cloudNote')}
      </p>
    </div>
  );
}
