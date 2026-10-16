import { test, expect } from '@playwright/test';
import { injectSafeArea } from './helpers/touch.js';
import { seedProject } from './helpers/seedProject.js';
import fullFixture from '../tests/fixtures/roundtrip-full.json' with { type: 'json' };

test.describe('F19: iOS Safari iPhone 16 Pro Max 行動版 UI 與 HIG 規格驗證', () => {
  let projectId;

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
    projectId = await seedProject(page, fullFixture, { roles: ['admin'] });
  });

  test('F19-1: 關鍵頁面無水平溢出 (scrollWidth === 440)', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 440, '僅針對 440px 視口執行');

    const routes = [
      '/#/projects',
      `/#/projects/${projectId}/dashboard`,
      `/#/projects/${projectId}/basicInfo`,
      `/#/projects/${projectId}/smtControl`,
      `/#/projects/${projectId}/signOff`,
      '/#/account',
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `頁面 ${route} 存在水平溢出: scrollWidth 為 ${scrollWidth}`).toBe(440);
    }
  });

  test('F19-2: 觸控點擊區 ≥ 44×44，主要按鈕 ≥ 50px', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 440, '僅針對 440px 視口執行');

    await page.goto(`/#/projects/${projectId}/basicInfo`);
    await page.waitForLoadState('networkidle');

    const violations = await page.evaluate(() => {
      const items = [...document.querySelectorAll('a, button, input, select, textarea, summary, [role="button"]')];
      const errors = [];
      for (const el of items) {
        if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // 若是 checkbox/radio，但包在 label 內，以 label 量測
        let targetRect = rect;
        if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) {
          targetRect = el.closest('label').getBoundingClientRect();
        }

        const isPrimary = el.classList.contains('btn-primary') || el.classList.contains('step-btn-next');
        const minH = isPrimary ? 50 : 44;
        const minW = 44;

        if (targetRect.height < minH - 1 || targetRect.width < minW - 1) {
          errors.push({
            tag: el.tagName,
            text: (el.textContent || el.name || el.className || '').trim().slice(0, 30),
            w: Math.round(targetRect.width),
            h: Math.round(targetRect.height),
            expectedH: minH,
            expectedW: minW,
          });
        }
      }
      return errors;
    });

    expect(violations).toEqual([]);
  });

  test('F19-3: 表單輸入計算字級 ≥ 16px，無小於 12px 之字體 (底欄標籤除外)', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 440, '僅針對 440px 視口執行');

    await page.goto(`/#/projects/${projectId}/basicInfo`);
    await page.waitForLoadState('networkidle');

    const fontCheck = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input, select, textarea')];
      const smallInputs = [];
      for (const el of inputs) {
        if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') continue;
        const fs = parseFloat(window.getComputedStyle(el).fontSize);
        if (fs < 16) {
          smallInputs.push({ name: el.name || el.placeholder, fs });
        }
      }

      // 檢查非 tab-label 的可見文字元素
      const allTextNodes = [...document.querySelectorAll('body *:not(script):not(style)')];
      const tinyTexts = [];
      for (const el of allTextNodes) {
        if (el.closest('.mobile-tab-label') || el.closest('.save-hint') || el.classList.contains('mobile-tab-label')) continue;
        if (el.children.length > 0) continue; // 僅檢查葉子文字節點
        const text = (el.textContent || '').trim();
        if (!text) continue;
        const fs = parseFloat(window.getComputedStyle(el).fontSize);
        if (fs < 12) {
          tinyTexts.push({ text: text.slice(0, 20), fs, tag: el.tagName });
        }
      }

      return { smallInputs, tinyTexts };
    });

    expect(fontCheck.smallInputs).toEqual([]);
    expect(fontCheck.tinyTexts).toEqual([]);
  });

  test('F19-4: MobileTabBar 顯示行為與視口響應', async ({ page }) => {
    const w = page.viewportSize()?.width || 0;

    if (w === 440) {
      await page.goto('/#/projects');
      await page.waitForLoadState('networkidle');
      const tabbar = page.locator('.mobile-tab-bar');
      await expect(tabbar).toBeVisible();

      // 檢查 position: fixed
      const position = await tabbar.evaluate(el => window.getComputedStyle(el).position);
      expect(position).toBe('fixed');

      // 進入步驟頁時，隱藏 MobileTabBar 避免遮擋 >120px
      await page.goto(`/#/projects/${projectId}/basicInfo`);
      await page.waitForLoadState('networkidle');
      await expect(tabbar).toBeHidden();
    } else if (w >= 768) {
      await page.goto('/#/projects');
      await page.waitForLoadState('networkidle');
      const tabbar = page.locator('.mobile-tab-bar');
      await expect(tabbar).toBeHidden();
    }
  });

  test('F19-5: 步驟頁捲動至 50% 時動作列保持可見，下一步切換資料不遺失', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 440, '僅針對 440px 視口執行');

    await page.goto(`/#/projects/${projectId}/basicInfo`);
    await page.waitForLoadState('networkidle');

    // 修改基本資料中的料號
    const testProductNo = 'PN-IOS-TEST-999';
    await page.fill('input[name="basicInfo.productNo"]', testProductNo);

    // 捲動至 50%
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
    await page.waitForTimeout(200);

    // 檢查 StepActionBar 依然可見
    const nextBtn = page.locator('.step-btn-next, .btn-primary:has-text("下一步")');
    await expect(nextBtn).toBeVisible();

    // 點擊下一步
    await nextBtn.click();
    await page.waitForURL(new RegExp(`/#/projects/${projectId}/(quality-process|qualityProcess)`));

    // 回到 basicInfo 驗證資料保留
    await page.goto(`/#/projects/${projectId}/basicInfo`);
    await page.waitForLoadState('networkidle');
    const val = await page.inputValue('input[name="basicInfo.productNo"]');
    expect(val).toBe(testProductNo);
  });

  test('F19-6: 深色模式背景 #0B0D12 與對比驗證', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 440, '僅針對 440px 視口執行');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`/#/projects/${projectId}/dashboard`);
    await page.waitForLoadState('networkidle');

    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // #0B0D12 對應 rgb(11, 13, 18)
    expect(bgColor).toBe('rgb(11, 13, 18)');

    // 頂欄儲存狀態在手機端可見
    const saveHint = page.locator('.save-hint');
    await expect(saveHint).toBeVisible();
  });

  test('F19-7: 注入 Safe-Area 頂欄與底欄不遮擋', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 440, '僅針對 440px 視口執行');

    await injectSafeArea(page, { top: 62, bottom: 34 });
    await page.goto('/#/projects');
    await page.waitForLoadState('networkidle');

    const topbar = page.locator('.mobile-project-header');
    await expect(topbar).toBeVisible();

    const tabbar = page.locator('.mobile-tab-bar');
    await expect(tabbar).toBeVisible();
  });
});
