import { test, expect } from '@playwright/test';
import { measureTouchTargets, injectSafeArea } from './helpers/touch.js';

test.describe('F11: 多裝置響應式架構、觸控規格與安全區域', () => {
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

  test('F11-1: 觸控主要互動目標點擊區 ≥ 44×44，主要按鈕 ≥ 48', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    const violations = await measureTouchTargets(page);
    if (violations.length > 0) {
      console.log('VIOLATIONS:', JSON.stringify(violations, null, 2));
    }
    // 斷言在觸控環境下無違規微小按鈕
    expect(violations.length).toBe(0);
  });

  test('F11-9: 手機端版型徹底移除漢堡全螢幕遮罩 (M5 去彈窗化)', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // 驗證絕無 shell-backdrop 覆蓋層
    expect(await page.locator('.shell-backdrop').count()).toBe(0);
  });

  test('F11-17: 注入安全區域 CSS 變數時介面正常渲染無破版', async ({ page }) => {
    await injectSafeArea(page, { top: 62, bottom: 34, left: 0, right: 0 });
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    // 驗證頁面能正常顯示
    await expect(page.locator('.app-shell, .project-list-container')).toBeVisible();
  });
});
