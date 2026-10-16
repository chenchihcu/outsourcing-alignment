import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 連線（離線優先與環境變數解耦設計，遵循 AGENTS.md 第 38-40 行規定）。
 * 前端客戶端嚴禁硬編碼預設連線金鑰，必須完全由環境變數（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）
 * 動態決定 isSupabaseEnabled。未提供環境變數時退回離線優先模式，避免無頭自動化測試遭遇遠端網路限流或連線超時死鎖。
 *
 * 設定方式：於專案根目錄建立 .env（可複製 .env.example）：
 *   VITE_SUPABASE_URL=https://<project-ref>.example-domain
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
