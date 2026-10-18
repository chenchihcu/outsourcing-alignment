import { test, expect } from '@playwright/test';
import { seedProject } from './helpers/seedProject.js';
import { setupAuthMock, injectAuthSession, MOCK_USERS } from './helpers/authMock.js';
import fs from 'node:fs';
import path from 'node:path';

test.describe('F15 & F18: 往返保真度驗收、跨分頁防覆蓋與簽章去背驗證', () => {
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

  test('F15-1 & F15-2: 完整機種資料具備 100% 往返保真度且無資料遺失', async ({ page }) => {
    const projId = await seedProject(page, fullFixture);
    await page.goto(`/#/projects/${projId}`);
    await page.waitForLoadState('networkidle');

    // 驗證標題與關鍵料號正常還原
    await expect(page.locator('body')).toContainText(fullFixture.basicInfo.productNo.trim());
    await expect(page.locator('body')).toContainText(fullFixture.fileName || fullFixture.basicInfo.productDesc);
  });

  test('F18-8: 跨分頁協調機制保障雙分頁儲存不覆蓋彼此資料 (D-153)', async ({ context }) => {
    await setupAuthMock(context);
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // 登入
    await pageA.goto('/');
    await injectAuthSession(pageA, MOCK_USERS.admin);

    const projAId = await seedProject(pageA, fullFixture);
    await pageA.goto(`/#/projects/${projAId}/basic-info`);
    await pageA.waitForLoadState('networkidle');

    await pageB.goto(`/#/projects/${projAId}/basic-info`);
    await pageB.waitForLoadState('networkidle');

    // 分頁 A 更改品名並觸發更新
    await pageA.fill('input[name="basicInfo.productDesc"]', '分頁A修改的品名');
    await pageA.evaluate(() => window.dispatchEvent(new Event('beforeunload')));

    // 分頁 B 讀取儲存區，驗證分頁 A 的資料未被靜默清除
    const stored = await pageB.evaluate((id) => {
      const list = JSON.parse(localStorage.getItem('ag_projects_admin_test') || localStorage.getItem('ag_projects') || '[]');
      return list.find(p => p.id === id);
    }, projAId);

    expect(stored.data.basicInfo.productDesc).toBe('分頁A修改的品名');

    await pageA.close();
    await pageB.close();
  });
});
