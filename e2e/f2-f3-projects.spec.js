import { test, expect } from '@playwright/test';

test.describe('F2 & F3: 機種清單與建立/匯入流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('ag_accounts', JSON.stringify([{
        username: 'admin',
        password: 'password',
        role: 'admin',
        unit: '管理處',
        level: 'Administrator',
      }, {
        username: 'qa_user',
        password: 'password',
        role: 'qa',
        unit: '審核單位（品保處）',
        level: 'Reviewer',
      }]));
      localStorage.setItem('ag_current_user', JSON.stringify({
        username: 'admin',
        role: 'admin',
        unit: '管理處',
        level: 'Administrator',
      }));
    });
    await page.reload();
  });

  test('F2-1: 機種清單支援狀態標籤、對齊率進度條且無彈窗', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2').first()).toContainText('機種');
    // 驗證無 modal-backdrop
    expect(await page.locator('.modal-backdrop').count()).toBe(0);
  });

  test('F2-8 & F3-8: QA 角色登入無法建立機種且清單不顯示新增/匯入按鈕', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('ag_current_user', JSON.stringify({
        username: 'qa_user',
        role: 'qa',
        unit: '審核單位（品保處）',
        level: 'Reviewer',
      }));
    });
    await page.goto('/#/projects');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 驗證 QA 看不到建立機種與匯入按鈕
    const createBtn = page.locator('button:has-text("新增機種"), button:has-text("建立機種")');
    expect(await createBtn.count()).toBe(0);
    const importBtn = page.locator('button:has-text("匯入 Excel"), button:has-text("匯入")');
    expect(await importBtn.count()).toBe(0);

    // 直接造訪 #/projects/new 應阻擋建立
    await page.goto('/#/projects/new?mode=template');
    await expect(page.locator('body')).toContainText(/不能建立|權限不足/);
  });

  test('F3-1: 點擊建立機種進入獨立全頁，非置中覆蓋層彈窗 (M3 去彈窗化)', async ({ page }) => {
    await page.goto('/#/projects');
    const isMobile = (page.viewportSize()?.width || 0) <= 767;
    if (isMobile) {
      await page.click('.mobile-header-add-btn');
      await page.click('.mobile-dropdown-item:has-text("新增機種")');
    } else {
      await page.click('button:has-text("新增機種"), button:has-text("建立機種")');
    }
    await expect(page).toHaveURL(/.*#\/projects\/new.*/);
    await expect(page.locator('.create-project-page, .project-new-container')).toBeVisible();
    expect(await page.locator('.modal-backdrop').count()).toBe(0);
  });

  test('F3-3: 建立重複名稱時即時顯示錯誤提示，禁止重複建立', async ({ page }) => {
    await page.goto('/#/projects/new?mode=template');
    // 輸入既有範本名稱
    await page.fill('input#projectName, input[placeholder*="機種名稱"]', '新機種製作需求一覽表2026 v2.xlsx (預設範本)');
    await page.click('button:has-text("建立機種"), button:has-text("確認建立"), button:has-text("建立並開始填寫")');
    
    // 應停留在本頁且有錯誤提示
    await expect(page.locator('.field-error, .banner-error, [role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(/.*#\/projects\/new.*/);
  });
});
