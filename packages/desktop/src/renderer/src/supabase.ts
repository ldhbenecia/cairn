import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const cfg = window.cairn.supabase;

// 딥링크로 콜백을 직접 처리하므로 detectSessionInUrl=false. PKCE verifier 는 localStorage 유지.
export const supabase: SupabaseClient | null = cfg
  ? createClient(cfg.url, cfg.key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
