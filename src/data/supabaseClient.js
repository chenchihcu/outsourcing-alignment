import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 連線（純雲端上線架構）。
 * 網站架於 Cloudflare，全域支援手機與跨網連線，所有專案皆為純雲端上線模式（無本機離線模式）。
 *
 * 設定方式：於環境變數（如 .env 或 Cloudflare Dashboard / GitHub Secrets）設定：
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=xxxxx
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const isSupabaseEnabled = isSupabaseConfigured;

if (!isSupabaseConfigured) {
  console.warn('[supabase] 尚未配置雲端服務金鑰 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)。本系統為純雲端模式，請配置環境變數。');
}

export const supabase = isSupabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'ag_sb_auth',
      },
    })
  : null;
