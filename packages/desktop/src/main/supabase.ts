import { readEnvFile } from './setup';

export type SupabaseConfig = { url: string; key: string };

export function readSupabaseConfig(): SupabaseConfig | null {
  const env = readEnvFile();
  const url = (env.SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim();
  const key = (
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  if (!url || !key) return null;
  return { url, key };
}
