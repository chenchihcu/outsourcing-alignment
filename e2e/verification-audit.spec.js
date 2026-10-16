import { test, expect } from '@playwright/test';

async function mockSuccessfulCloudLogin(page) {
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: '11111111-1111-1111-1111-111111111111',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'testadmin@mitcorp.local',
          user_metadata: {
            username: 'testadmin',
            role: 'admin',
            unit: '管理處',
            level: 'Administrator',
          },
        },
      }),
    });
  });

  await page.route('**/rest/v1/profiles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: '11111111-1111-1111-1111-111111111111',
        username: 'testadmin',
        role: 'admin',
        unit: '管理處',
        level: 'Administrator',
      }]),
    });
  });

  await page.route('**/rest/v1/projects*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('審查與驗證：閒置登出修復與安全退回前後對照', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('測試 1: 預先寫入 2 小時前的 ag_last_activity，登入後等 7 秒，仍停在原頁面且保持登入', async ({ page }) => {
    await mockSuccessfulCloudLogin(page);

    await page.goto('/#/login');
    // 寫入 2 小時前的 ag_last_activity
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    await page.evaluate((ts) => {
      localStorage.setItem('ag_last_activity', String(ts));
    }, twoHoursAgo);

    await page.fill('input[type="text"], input[name="username"]', 'testadmin');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // 登入後應進入 #/projects
    await expect(page).toHaveURL(/.*#\/projects/);

    // 等待 7 秒 (超過 5 秒的定期檢查)
    await page.waitForTimeout(7000);

    // 驗證是否仍停在原頁面且保持登入 (未被逾時登出踢回 /login)
    await expect(page).toHaveURL(/.*#\/projects/);
    expect(page.url()).not.toContain('/login');
  });

  test('測試 2: 閒置逾時登出後，登入頁顯示自動登出原因；再次登入不會又被登出', async ({ page }) => {
    await mockSuccessfulCloudLogin(page);

    await page.goto('/#/login');
    await page.fill('input[type="text"], input[name="username"]', 'testadmin');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*#\/projects/);

    // 模擬時間流逝 31 分鐘，觸發閒置逾時
    const pastTime = Date.now() - 31 * 60 * 1000;
    await page.evaluate((ts) => {
      localStorage.setItem('ag_last_activity', String(ts));
    }, pastTime);

    // 等待 6 秒觸發自動登出
    await page.waitForTimeout(6000);
    await expect(page).toHaveURL(/.*#\/login.*/);

    // 登入頁應顯示自動登出原因 (頁內提示，非彈窗)
    const notice = page.locator('.login-notice-banner, [role="status"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('因長時間無操作，已自動登出');

    // 再次登入
    await page.fill('input[type="text"], input[name="username"]', 'testadmin');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*#\/projects/);

    // 等待 7 秒不會又被登出
    await page.waitForTimeout(7000);
    await expect(page).toHaveURL(/.*#\/projects/);
  });

  test('測試 3: #/login?from=settings%2Ffactories 登入成功後，會進入 #/settings/factories', async ({ page }) => {
    await mockSuccessfulCloudLogin(page);

    await page.goto('/#/login?from=settings%2Ffactories');
    await page.fill('input[type="text"], input[name="username"]', 'testadmin');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*#\/settings\/factories/);
  });

  test('測試 4: 雲端登入失敗時，不會用任何本機帳號進入系統', async ({ page }) => {
    // 預置本機帳號庫
    await page.evaluate(() => {
      localStorage.setItem('ag_accounts', JSON.stringify([{
        username: 'localadmin',
        password: 'localpassword',
        role: 'admin',
        unit: '管理處',
        level: 'Administrator',
      }]));
    });

    await page.goto('/#/login');
    // 嘗試以未授權之帳密登入 (雲端會回傳 Invalid login credentials)
    await page.fill('input[type="text"], input[name="username"]', 'unknown_cloud_user');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 驗證絕不進入系統，並停留在登入頁
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/.*#\/login.*/);
    const errorBanner = page.locator('.login-error-banner, [role="alert"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/錯誤|失敗/);
  });

  test('測試 5: 沒有 session 但手動寫入 ag_current_user 時，仍停在登入頁', async ({ page }) => {
    await page.goto('/#/login');
    await page.evaluate(() => {
      localStorage.setItem('ag_current_user', JSON.stringify({
        username: 'hacker',
        role: 'admin',
        unit: '管理處',
        level: 'Administrator',
      }));
    });

    await page.goto('/#/projects');
    await page.reload();
    await page.waitForTimeout(1000);

    // 正確行為：無有效 session 時應停在 /#/login，絕不信任快取的 ag_current_user
    await expect(page).toHaveURL(/.*#\/login.*/);
  });
});
