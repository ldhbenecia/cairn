import { Check } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../../settings-context';
import { Toggle } from '../toggle';
import { Field, Section } from './field';

const ghostBtn =
  'rounded-md px-2.5 py-1 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink';

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
        <button
          type="button"
          onClick={() => void test()}
          className={
            sent === 'ok'
              ? 'flex items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] text-success'
              : ghostBtn
          }
        >
          {sent === 'ok' && <Check size={13} strokeWidth={2.5} />}
          {sent === 'ok' ? t('prefs.notifications.sent') : t('prefs.notifications.sendBtn')}
        </button>
      </Field>
      <Field label={t('prefs.notifications.macos')}>
        <button
          type="button"
          onClick={() =>
            void window.cairn.openExternal(
              'x-apple.systempreferences:com.apple.Notifications-Settings.extension',
            )
          }
          className={ghostBtn}
        >
          {t('prefs.notifications.openBtn')}
        </button>
      </Field>
      {sent && (
        <p className="pt-3 text-[12px] leading-relaxed text-ink-tertiary">
          {sent === 'ok' ? t('prefs.notifications.sentHint') : t('prefs.notifications.unsupported')}
        </p>
      )}
    </Section>
  );
}
