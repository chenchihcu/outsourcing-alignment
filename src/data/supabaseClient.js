import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 連線(離線優先設計)。
 * 未設定環境變數時 isSupabaseEnabled = false,整個 App 退回純 localStorage 行為,
 * 與導入 Supabase 前完全一致。設定後即啟用雲端同步與即時協作。
 *
 * 設定方式:於專案根目錄建立 .env(可複製 .env.example):
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=xxxxx
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// E5 — 環境變數不完整時提示
if ((url && !anonKey) || (!url && anonKey)) {
  console.error('[supabase] 設定不完整：VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY 必須同時設定或同時留空。');
}

export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase = isSupabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'ag_sb_auth',
      },
    })
  : null;
