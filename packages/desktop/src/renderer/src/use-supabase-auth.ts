import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function useSupabaseAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      setLoading(false);
      return;
    }
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    const off = window.cairn.onDeepLink((url) => {
      const code = new URL(url).searchParams.get('code');
      if (!code) return;
      void sb.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (err) setError(err.message);
      });
    });
    return () => {
      sub.subscription.unsubscribe();
      off();
    };
  }, []);

  const signIn = async (): Promise<void> => {
    if (!supabase) return;
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'cairn://auth-callback', skipBrowserRedirect: true },
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (data.url) await window.cairn.openExternal(data.url);
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return { configured: !!supabase, loading, session, error, signIn, signOut };
}
