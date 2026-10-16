import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 連線（永遠在線模式）。
 * 網站架於 Cloudflare，全域支援手機與跨網連線，所有專案皆為純雲端上線模式（廢除本機離線模式）。
 * 預設連線至雲端端點，若有自訂環境變數則優先使用。
 */
const DEFAULT_SUPABASE_URL = 'https://jqtvmdlnondubzaximle.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_7bmAjp-e_t0eRAyQxKj70Q_Hv5dQXow';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = true;
// 全系統永遠為雲端在線模式（廢除本機離線模式）
export const isSupabaseEnabled = true;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'ag_sb_auth',
  },
});
