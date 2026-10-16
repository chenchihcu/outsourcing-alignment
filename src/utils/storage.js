const STORAGE_PREFIX = 'ag_';

/**
 * 安全讀取 localStorage 中的 JSON 資料 (D-137)
 * 若解析失敗，將損毀資料保存至 ag_corrupt_<key>_<timestamp>，絕不靜默刪除全部資料
 */
export function getJSON(key, fallback = null) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch {
    console.warn(`[storage] 讀取 ${key} 失敗，保留損毀備份`);
    try {
      const rawCorrupt = localStorage.getItem(fullKey);
      if (rawCorrupt) {
        localStorage.setItem(`${STORAGE_PREFIX}corrupt_${key}_${Date.now()}`, rawCorrupt);
      }
      localStorage.removeItem(fullKey);
    } catch {
      /* 清除失敗可忽略 */
    }
    return fallback;
  }
}

export function setJSON(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn(`[storage] ${key} 儲存失敗：localStorage 容量已滿`);
    }
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* removeItem 可忽略 */
  }
}

export function getRaw(key) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * 取得最新本機機種清單 (D-153)
 * @param {string} storageKey 
 * @returns {Array}
 */
export function getStoredProjects(storageKey) {
  const list = getJSON(storageKey, []);
  if (!Array.isArray(list)) return [];
  return list.map((p) => ({
    ...p,
    version: typeof p.version === 'number' && !Number.isNaN(p.version) ? p.version : 1,
  }));
}

/**
 * 單一機種安全寫入核心函式 (D-153, D-75)
 * 重新自 localStorage 讀取最新清單，只修改目標機種，防止跨分頁覆蓋與復活已刪除機種
 * 
 * @param {string} storageKey - localStorage key (如 'projects' 或 'projects_username')
 * @param {string} projectId - 機種 ID
 * @param {Function} updater - 接收目前儲存中的 project，回傳更新後物件
 * @param {number} [baseVersion] - 當前分頁載入時之 version，若儲存中版本較新則判定衝突
 * @returns {{ success: boolean, updated?: boolean, conflict?: boolean, deleted?: boolean, project?: Object, error?: string }}
 */
export function updateStoredProject(storageKey, projectId, updater, baseVersion) {
  if (!storageKey || !projectId || typeof updater !== 'function') {
    return { success: false, error: '參數不正確' };
  }

  const latestList = getStoredProjects(storageKey);
  const existingIndex = latestList.findIndex((p) => p.id === projectId);

  if (existingIndex === -1) {
    // 該機種已被刪除 (防止已刪除機種被陳舊分頁復活)
    return { success: false, deleted: true, error: '該機種已在其他分頁或裝置被刪除' };
  }

  const currentProject = latestList[existingIndex];
  const currentVersion = currentProject.version || 1;

  // 衝突檢查：若外部有提供基準版本且儲存中的版本比基準版本大，判定為衝突
  if (typeof baseVersion === 'number' && currentVersion > baseVersion) {
    return {
      success: false,
      conflict: true,
      storedProject: currentProject,
      baseVersion,
      error: '儲存區已有較新版本之變更',
    };
  }

  const updatedProjectCandidate = updater(currentProject);
  if (!updatedProjectCandidate) {
    return { success: true, updated: false, project: currentProject };
  }

  // D-75: 檢查是否有實質修改 (無實質修改不更新 updatedAt 與 version)
  const isDataEqual = JSON.stringify(currentProject.data) === JSON.stringify(updatedProjectCandidate.data);
  const isOwnersEqual = JSON.stringify(currentProject._owners || {}) === JSON.stringify(updatedProjectCandidate._owners || {});
  const isNameEqual = currentProject.name === updatedProjectCandidate.name;

  if (isDataEqual && isOwnersEqual && isNameEqual) {
    return { success: true, updated: false, project: currentProject };
  }

  // 真正有實質修改，version + 1 並更新時間戳
  const finalProject = {
    ...updatedProjectCandidate,
    id: projectId,
    version: currentVersion + 1,
    updatedAt: new Date().toISOString(),
  };

  const nextList = [...latestList];
  nextList[existingIndex] = finalProject;

  const ok = setJSON(storageKey, nextList);
  return {
    success: ok,
    updated: true,
    project: finalProject,
  };
}

/**
 * 新增單一機種至儲存區 (D-153)
 * @param {string} storageKey 
 * @param {Object} newProject 
 * @returns {boolean}
 */
export function insertStoredProject(storageKey, newProject) {
  if (!storageKey || !newProject || !newProject.id) return false;
  const latestList = getStoredProjects(storageKey);
  if (latestList.some((p) => p.id === newProject.id)) {
    return false; // 已存在同 ID
  }
  const projectWithVersion = {
    ...newProject,
    version: typeof newProject.version === 'number' ? newProject.version : 1,
    createdAt: newProject.createdAt || new Date().toISOString(),
    updatedAt: newProject.updatedAt || new Date().toISOString(),
  };
  return setJSON(storageKey, [projectWithVersion, ...latestList]);
}

/**
 * 自儲存區刪除單一機種 (D-153)
 * @param {string} storageKey 
 * @param {string} projectId 
 * @returns {boolean}
 */
export function deleteStoredProject(storageKey, projectId) {
  if (!storageKey || !projectId) return false;
  const latestList = getStoredProjects(storageKey);
  const nextList = latestList.filter((p) => p.id !== projectId);
  return setJSON(storageKey, nextList);
}
