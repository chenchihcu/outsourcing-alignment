import { supabase, isSupabaseEnabled } from './supabaseClient';

/* 帳號登入用的固定內部網域:使用者只需打帳號(例 pe),系統自動補成 pe@mitcorp.local */
export const LOGIN_DOMAIN = 'mitcorp.local';

/** 帳號 → 登入 email:已含 @ 視為完整 email;否則補上固定網域 */
export function toLoginEmail(identifier) {
  const id = (identifier || '').trim();
  return id.includes('@') ? id : `${id}@${LOGIN_DOMAIN}`;
}

/* Supabase session + profile → App 的 currentUser 形狀 */
function toCurrentUser(profile, user) {
  return {
    id: user?.id,
    email: user?.email,
    username: profile?.username || user?.email || '',
    unit: profile?.unit || '',
    role: profile?.role || 'rd',
    level: profile?.level || '',
    signature: profile?.signature || null,
  };
}

/** 以帳號(或 email)+密碼登入。帳號會自動補上固定網域;回傳 currentUser */
export async function signIn(account, password) {
  const email = toLoginEmail(account);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return getCurrentUser();
}

export async function signOut() {
  if (!isSupabaseEnabled) return { remoteRevoked: true };
  const { error } = await supabase.auth.signOut();
  if (!error) return { remoteRevoked: true };

  const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
  if (localError) throw localError;
  return { remoteRevoked: false, error };
}

/** 從現有 session 還原 currentUser(無 session 回傳 null) */
export async function getCurrentUser() {
  if (!isSupabaseEnabled) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  return toCurrentUser(profile, session.user);
}

/** 更新本人簽章到 profile(失敗時拋錯,讓呼叫端能提示使用者) */
export async function updateMySignature(signature) {
  if (!isSupabaseEnabled) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('尚未登入，無法同步簽章');
  const { error } = await supabase
    .from('profiles')
    .update({ signature: signature || null })
    .eq('id', session.user.id);
  if (error) throw error;
}

/** 監聽登入狀態變化(回傳取消訂閱) */
export function onAuthChange(cb) {
  if (!isSupabaseEnabled) return () => {};
  const { data } = supabase.auth.onAuthStateChange(() => { cb(); });
  return () => data.subscription.unsubscribe();
}

// =========================================================================
// Admin 專用：使用者管理（須搭配 invite-user Edge Function + admin RLS）
// =========================================================================

/** 以 Edge Function 邀請新使用者（service_role 隔在伺服器端） */
export async function inviteUser({ email, username, unit, role, level }) {
  if (!isSupabaseEnabled) throw new Error('雲端模式未啟用');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('請先登入');

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, username, unit, role, level }),
    },
  );
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || '邀請失敗');
  return payload;
}

/** 取得所有使用者的 profile（admin RLS 允許讀取） */
export async function listAllProfiles() {
  if (!isSupabaseEnabled) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

/** 更新指定使用者的 profile 欄位（須 admin RLS） */
export async function updateUserProfile(userId, updates) {
  if (!isSupabaseEnabled) return;
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}
