/**
 * 一鍵初始化 / 建立 Supabase 管理員帳號工具
 * 
 * 使用方式：
 *   node scripts/bootstrapAdmin.mjs <SERVICE_ROLE_KEY> [password] [email]
 * 
 * 或在 .env 設定 SUPABASE_SERVICE_ROLE_KEY 後直接執行：
 *   node --env-file=.env scripts/bootstrapAdmin.mjs
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://jqtvmdlnondubzaximle.supabase.co';
const serviceRoleKey = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPassword = process.argv[3] || process.env.ADMIN_INITIAL_PASSWORD || 'Admin@Mitcorp2026!';
const adminEmail = (process.argv[4] || process.env.ADMIN_EMAIL || 'admin@mitcorp.local').toLowerCase().trim();

if (!serviceRoleKey) {
  console.error('\n❌ 缺少 Supabase Service Role Key！');
  console.log('\n說明：');
  console.log('  由於建立或重設使用者密碼需要管理員權限，請提供 Supabase 的 service_role key。');
  console.log('  取得方式：前往 Supabase Dashboard -> 專案 Settings -> API -> Project API keys -> service_role (secret)');
  console.log('\n執行指令範例：');
  console.log('  node scripts/bootstrapAdmin.mjs <你的_service_role_key> <自訂密碼>\n');
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('\n========================================================');
  console.log('  🚀 產品委外加工對齊系統 — Supabase 管理員帳號初始化');
  console.log('========================================================\n');
  console.log(`連線目標: ${url}`);
  console.log(`管理員信箱: ${adminEmail} (系統登入可直接輸入前綴: ${adminEmail.split('@')[0]})`);

  // 1. 檢查使用者是否已存在
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error('查詢既有使用者失敗:', listError.message);
    process.exit(1);
  }

  const existingUser = usersData.users.find(u => u.email.toLowerCase() === adminEmail);
  let userId;

  if (existingUser) {
    console.log(`\n偵測到既有帳號 (ID: ${existingUser.id})，正在更新密碼與管理員權限...`);
    const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          username: 'admin',
          unit: '管理處',
          role: 'admin',
          level: 'Administrator'
        }
      }
    );
    if (updateError) {
      console.error('更新使用者失敗:', updateError.message);
      process.exit(1);
    }
    userId = updated.user.id;
    console.log('✓ 帳號密碼與權限已成功更新！');
  } else {
    console.log('\n正在建立全新管理員帳號...');
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        username: 'admin',
        unit: '管理處',
        role: 'admin',
        level: 'Administrator'
      }
    });
    if (createError) {
      console.error('建立使用者失敗:', createError.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log('✓ 管理員帳號建立成功！');
  }

  // 2. 確保 profiles 表資料正確同步
  console.log('正在確認 profiles 資料表權限記錄...');
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      username: 'admin',
      unit: '管理處',
      role: 'admin',
      level: 'Administrator'
    }, { onConflict: 'id' });

  if (profileError) {
    console.warn('⚠️ 寫入 profiles 表時出現提示 (若有 trigger 自動同步則無礙):', profileError.message);
  } else {
    console.log('✓ profiles 資料表權限記錄已同步！');
  }

  console.log('\n========================================================');
  console.log('  🎉 管理員帳號配置完成！您現在可以登入系統：');
  console.log('========================================================');
  console.log(`  登入網址: 本機 http://localhost:5173 或 Cloudflare Pages 正式網址`);
  console.log(`  登入帳號: admin (或 ${adminEmail})`);
  console.log(`  登入密碼: ${adminPassword}`);
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('執行過程發生未預期錯誤:', err);
  process.exit(1);
});
