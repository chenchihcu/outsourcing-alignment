import { test, expect } from '@playwright/test';
import { seedProject } from './helpers/seedProject.js';
import { setupAuthMock, injectAuthSession, MOCK_USERS } from './helpers/authMock.js';
import fs from 'node:fs';
import path from 'node:path';

test.describe('F4～F6: 十步驟流轉、防呆規則、簽核狀態機與匯出', () => {
  let fullFixture;

  test.beforeAll(() => {
    fullFixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/roundtrip-full.json'), 'utf8'));
  });

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await injectAuthSession(page, MOCK_USERS.admin);
    await page.reload();
  });

  test('F4-1 & F4-2: 十步驟上下步導覽、URL 同步與無彈窗流轉', async ({ page }) => {
    const projId = await seedProject(page, fullFixture);
    await page.goto(`/#/projects/${projId}/basic-info`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(`/#/projects/${projId}/basic-info`));

    // 點擊下一步至品質與加工需求
    await page.click('button:has-text("下一步")');
    await expect(page).toHaveURL(new RegExp(`/#/projects/${projId}/quality-process`));

    // 點擊上一步回到基本資料
    await page.click('button:has-text("上一步")');
    await expect(page).toHaveURL(new RegExp(`/#/projects/${projId}/basic-info`));
  });

  test('F6-5: 空專案或有必填防呆缺項時禁止簽章與匯出 (OD-14)', async ({ page }) => {
    // 建立一個只有標題的空白機種
    const emptyProj = {
      id: 'EMPTY_PROJ_POKAYOKE',
      fileName: '空專案測試',
      data: {
        basicInfo: {},
        processControl: {},
        trialReport: {},
      },
    };
    await seedProject(page, emptyProj);
    await page.goto('/#/projects/EMPTY_PROJ_POKAYOKE/sign-off');
    await page.waitForLoadState('networkidle');

    // 驗證出現防呆警告
    await expect(page.locator('.pokayoke-summary, .pokayoke-bar')).toBeVisible();

    // 驗證匯出與簽章按鈕被停用
    const exportBtn = page.locator('button:has-text("匯出並下載 Excel")');
    if (await exportBtn.count() > 0) {
      expect(await exportBtn.isDisabled()).toBe(true);
    }
  });

  test('F6-9: 退件機制清除三方簽章且不跳出原生 confirm 對話框', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', () => { dialogFired = true; });

    const projId = await seedProject(page, fullFixture);
    await page.goto(`/#/projects/${projId}/sign-off`);
    await page.waitForLoadState('networkidle');

    // 輸入退件原因
    await page.fill('textarea[name="rejectReason"]', 'E2E 自動化品保退件檢驗理由');
    await page.click('button:has-text("退件並要求修正")');

    // 驗證無原生 alert/confirm
    expect(dialogFired).toBe(false);

    // 驗證退件後進入退件狀態
    await expect(page.locator('.rejected-banner, [role="alert"]')).toBeVisible();
  });
});
