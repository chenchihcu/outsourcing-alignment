/**
 * Playwright E2E 測試專用機種種子建立器 (遵循規格 10.1 規範)
 * 嚴禁使用 page.addInitScript，改採 page.goto -> 讀取 -> 依 id 合併 -> 寫回 -> reload
 */
import { CURRENT_DATA_VERSION } from '../../src/utils/dataVersion.js';

export async function seedProject(page, fixture, { legacy = false, roles = ['admin', 'rd'] } = {}) {
  const fixtureCopy = JSON.parse(JSON.stringify(fixture));
  const newId = fixtureCopy.id || `E2E_PROJ_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const project = fixtureCopy.data ? { ...fixtureCopy } : {
    id: newId,
    name: fixtureCopy.name || fixtureCopy.fileName || fixtureCopy.basicInfo?.productDesc || 'E2E 測試機種',
    data: fixtureCopy,
  };
  project.id = newId;
  project.name = project.name || fixtureCopy.name || fixtureCopy.fileName || 'E2E 測試機種';

  if (legacy) {
    delete project.dataVersion;
    if (project.data) delete project.data.dataVersion;
  } else {
    project.dataVersion = CURRENT_DATA_VERSION;
    if (project.data) project.data.dataVersion = CURRENT_DATA_VERSION;
  }

  // 1. 先開啟網頁
  await page.goto('/#/projects');
  await page.waitForLoadState('domcontentloaded');

  // 2. 在瀏覽器環境中讀取現有專案清單、合併新專案並寫回
  await page.evaluate(({ proj, rolesToSync }) => {
    // 依據共用 key 與相容 key 寫入
    const keys = ['ag_projects'];
    if (rolesToSync.includes('admin')) {
      keys.push('ag_projects_admin_test');
    }

    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        const list = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(p => p.id === proj.id);
        if (idx >= 0) {
          list[idx] = proj;
        } else {
          list.push(proj);
        }
        localStorage.setItem(k, JSON.stringify(list));
      } catch (e) {
        console.error('seedProject error:', e);
      }
    }
  }, { proj: project, rolesToSync: roles });

  // 3. 重新整理頁面以載入寫入之種子機種
  await page.reload();
  await page.waitForLoadState('networkidle');

  return newId;
}
