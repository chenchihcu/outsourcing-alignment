/**
 * 注入測試機種資料 (遵循規格 v2.24 規定：不使用 page.addInitScript)
 * 開啟網頁後用 page.evaluate 讀出既有 localStorage 資料，依 id 合併測試專案，寫回後重新載入一次。
 * 避免每次重新載入都把資料蓋回去。
 * 
 * @param {import('@playwright/test').Page} page
 * @param {Object} fixture - 測試專案資料
 * @param {Object} [options]
 * @param {string[]} [options.roles]
 */
export async function seedProject(page, fixture) {
  const proj = JSON.parse(JSON.stringify(fixture));
  
  // 開啟網頁進入基底頁面
  await page.goto('/#/projects');
  
  // 透過 page.evaluate 讀出既有專案，依 id 合併後寫回
  await page.evaluate(({ project }) => {
    const keys = ['ag_projects', 'ag_projects_admin_test', 'projects'];
    keys.forEach(key => {
      let list = [];
      try {
        const raw = localStorage.getItem(key);
        if (raw) list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }
      
      const idx = list.findIndex(p => p && p.id === project.id);
      if (idx >= 0) {
        list[idx] = project;
      } else {
        list.push(project);
      }
      localStorage.setItem(key, JSON.stringify(list));
    });
  }, { project: proj });

  // 寫回後重新載入一次
  await page.reload();
}
