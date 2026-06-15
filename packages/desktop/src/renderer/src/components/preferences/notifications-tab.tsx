import { useSettings } from '../../settings-context';
import { Toggle } from '../toggle';
import { Field } from './field';

export function NotificationsTab() {
  const { settings, update, t } = useSettings();
  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.notifications')} desc={t('prefs.notifications.desc')}>
        <Toggle checked={settings.notifications} onChange={(v) => update({ notifications: v })} />
      </Field>
      <Field label={t('prefs.notifications.test')} desc={t('prefs.notifications.testDesc')}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void window.cairn.testNotification()}
            className="rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink transition-colors hover:bg-surface-3"
          >
            {t('prefs.notifications.testBtn')}
          </button>
          <button
            type="button"
            onClick={() =>
              void window.cairn.openExternal(
                'x-apple.systempreferences:com.apple.Notifications-Settings.extension',
              )
            }
            className="rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {t('prefs.notifications.openSettings')}
          </button>
        </div>
      </Field>
    </div>
  );
}
