import { Cloud, LogOut } from 'lucide-react';
import { useSettings } from '../../settings-context';
import { useSupabaseAuth } from '../../use-supabase-auth';
import { Field } from './field';

export function SyncTab() {
  const { t } = useSettings();
  const { configured, loading, session, error, signIn, signOut } = useSupabaseAuth();

  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <Cloud size={26} strokeWidth={1.5} className="text-ink-tertiary" />
        <p className="text-[14px] font-medium text-ink-muted">{t('prefs.sync.notConfigured')}</p>
        <p className="max-w-xs text-[12px] leading-relaxed text-ink-tertiary">
          {t('prefs.sync.notConfiguredDesc')}
        </p>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.sync.account')} desc={t('prefs.sync.accountDesc')}>
        {loading ? (
          <span className="text-[13px] text-ink-tertiary">…</span>
        ) : user ? (
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-ink-muted">{user.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <LogOut size={14} strokeWidth={2} />
              {t('prefs.sync.signOut')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void signIn()}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
          >
            {t('prefs.sync.signInGoogle')}
          </button>
        )}
      </Field>
      {error && <p className="pt-3 text-[12px] leading-relaxed text-[#f87171]">{error}</p>}
    </div>
  );
}
