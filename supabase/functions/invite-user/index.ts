import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = new Set(['rd', 'eng', 'qa', 'admin']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: '未提供授權標頭' }, 401);

    // 以呼叫者 token 建立 client，驗證身分與角色
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return json({ error: '身分驗證失敗' }, 401);

    const { data: callerProfile } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      return json({ error: '僅系統管理員可邀請使用者' }, 403);
    }

    // 解析 body
    const { email, username, unit, role, level } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || '').trim();
    if (!normalizedEmail || !normalizedRole) return json({ error: '缺少必要欄位：email、role' }, 400);
    if (!ALLOWED_ROLES.has(normalizedRole)) return json({ error: '不支援的角色' }, 400);

    // 以 service_role 執行實際邀請（傳入 metadata，trigger 建 profile 時使用）
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: {
        username: String(username || '').trim() || normalizedEmail.split('@')[0],
      },
    });

    if (error) throw error;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        username: String(username || '').trim() || normalizedEmail.split('@')[0],
        unit: String(unit || '').trim(),
        role: normalizedRole,
        level: String(level || '').trim(),
      })
      .eq('id', data.user.id);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }

    return json({ success: true, userId: data.user.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '邀請失敗';
    return json({ error: msg }, 500);
  }
});
