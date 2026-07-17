import { Check } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../../settings-context';
import { Toggle } from '../toggle';
import { Field, Section } from './field';

export function NotificationsTab() {
  const { settings, update, t } = useSettings();
  // macOS 는 앱이 앞에 있으면 배너를 안 띄워서 인앱 피드백이 필요하다
  const [sent, setSent] = useState<'ok' | 'unsupported' | null>(null);

  const test = async (): Promise<void> => {
    const r = await window.cairn.testNotification();
    setSent(r.supported ? 'ok' : 'unsupported');
    setTimeout(() => setSent(null), 4000);
  };

  return (
    <Section label={t('prefs.section.general')}>
      <Field label={t('prefs.notifications')} desc={t('prefs.notifications.desc')}>
        <Toggle checked={settings.notifications} onChange={(v) => update({ notifications: v })} />
      </Field>
      <Field label={t('prefs.notifications.test')} desc={t('prefs.notifications.testDesc')}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void test()}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
              sent === 'ok'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-hairline bg-surface-2 text-ink hover:bg-surface-3'
            }`}
          >
            {sent === 'ok' && <Check size={14} strokeWidth={2.5} />}
            {sent === 'ok' ? t('prefs.notifications.sent') : t('prefs.notifications.testBtn')}
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
      {sent && (
        <p className="pt-3 text-[12px] leading-relaxed text-ink-tertiary">
          {sent === 'ok' ? t('prefs.notifications.sentHint') : t('prefs.notifications.unsupported')}
        </p>
      )}
    </Section>
  );
}
