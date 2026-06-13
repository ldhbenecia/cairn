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
    </div>
  );
}
