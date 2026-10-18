import { test, expect } from '@playwright/test';
import { setupAuthMock, injectAuthSession, MOCK_USERS } from './helpers/authMock.js';

test.describe('F1: 登入、登出與未登入保護流程', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('F1-1: 未登入開受保護頁面導向登入頁，且畫面上無預設帳密與快速登入', async ({ page }) => {
    await page.goto('/#/projects');
    await expect(page).toHaveURL(/.*#\/login.*/);
    
    // 驗證登入卡片存在
    await expect(page.locator('.login-card')).toBeVisible();

    // 驗證絕無快速測試登入按鈕
    const quickLoginBtns = page.locator('button:has-text("快速測試登入"), button:has-text("⚡")');
    expect(await quickLoginBtns.count()).toBe(0);

    // 驗證無預設密碼填充
    const pwInput = page.locator('input[type="password"]');
    expect(await pwInput.inputValue()).toBe('');
  });

  test('F1-2: 錯誤密碼登入或空白送出在欄位下方顯示錯誤反饋，不使用 alert', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', () => { dialogFired = true; });

    await page.goto('/#/login');
    // 空白送出
    await page.click('button[type="submit"]');
    expect(dialogFired).toBe(false);
    await expect(page.locator('.login-form [role="alert"]')).toBeVisible();

    // 錯誤帳密
    await page.fill('input[type="text"], input[name="username"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    expect(dialogFired).toBe(false);
    await expect(page.locator('.login-form [role="alert"]')).toContainText(/錯誤|不存在/);
  });

  test('F1-3: 正確登入後進入機種管理中心並顯示使用者資訊', async ({ page }) => {
    // 預先寫入測試管理員
    await page.evaluate(() => {
      localStorage.setItem('ag_accounts', JSON.stringify([{
        username: 'e2eadmin',
        password: 'e2epassword',
        role: 'admin',
        unit: '管理處',
        level: 'Administrator',
      }]));
    });

    await page.goto('/#/login');
    await page.reload();
    await page.fill('input[type="text"], input[name="username"]', 'e2eadmin');
    await page.fill('input[type="password"]', 'e2epassword');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*#\/projects/);
    await expect(page.locator('body')).toContainText('e2eadmin');
  });

  test('F1-7: 登出後清除 session 並回到登入頁，上一頁無法回到機種內容', async ({ page }) => {
    await injectAuthSession(page, MOCK_USERS.admin);

    await page.goto('/#/projects');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 點擊登出
    const burger = page.locator('.topbar-burger');
    if (await burger.isVisible()) {
      await burger.click();
      await page.waitForTimeout(300);
    } else {
      const accountTab = page.locator('.mobile-tab-item:has-text("帳號")');
      if (await accountTab.isVisible()) {
        await accountTab.click();
        await page.waitForTimeout(300);
      }
    }
    const logoutBtn = page.locator('.user-logout:visible, button:has-text("登出"):visible');
    await logoutBtn.first().click();
    await expect(page).toHaveURL(/.*#\/login/);

    // 驗證 localStorage current_user 已清空
    const currentUser = await page.evaluate(() => localStorage.getItem('ag_current_user'));
    expect(currentUser).toBeNull();

    // 瀏覽器上一頁嘗試
    await page.goBack();
    // 應依然重定向至 login
    await expect(page).toHaveURL(/.*#\/login.*/);
  });
});
