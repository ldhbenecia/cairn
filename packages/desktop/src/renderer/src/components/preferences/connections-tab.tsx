import { useSettings } from '../../settings-context';
import { Field } from './field';

export function ConnectionsTab({ onRerun }: { onRerun: () => void }) {
  const { t } = useSettings();
  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.connections')} desc={t('prefs.connections.desc')}>
        <button
          type="button"
          onClick={onRerun}
          className="rounded-md border border-hairline px-3 py-1.5 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          {t('prefs.rerunSetup')}
        </button>
      </Field>
    </div>
  );
}
