import { Component, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AppShell from './components/AppShell';
import ProjectList from './components/ProjectList';
import Dashboard from './components/Dashboard';
import FormSections from './components/FormSections';
import SignOff from './components/SignOff';
const PrintReport = lazy(() =>
  import('./components/PrintReport').catch(() => ({ default: () => null }))
);
import Settings from './components/Settings';
import AccountSettings from './components/AccountSettings';

import LoginModal from './components/LoginModal';
import { validateAlignment } from './utils/validator';
import { getNextWorkflowStep, getWorkflowStatuses } from './utils/workflow';
import { parseRequirementExcel } from './utils/excelParser';
import { getJSON, setJSON, removeKey, getStoredProjects, updateStoredProject, insertStoredProject, deleteStoredProject } from './utils/storage';
import { isSupabaseEnabled } from './data/supabaseClient';
import {
  pullProjects,
  pushProject,
  deleteProjectRemote,
  subscribeProjects,
  subscribePresence,
  pullFactories,
  migrateFactories,
  addFactoryRemote,
  deleteFactoryRemote,
  subscribeFactories,
} from './data/cloudSync';
import { migrateLocalProjects } from './data/migrateLocal';
import { getCurrentUser, onAuthChange, signOut, updateMySignature } from './data/auth';
import * as XLSX from 'xlsx';
import { navigateTo, TAB_TO_STEP_KEY, parseHash } from './utils/hashRouter.js';
import { WORKFLOW_STEPS } from './utils/workflow.js';
import { migrateProjectData, CURRENT_DATA_VERSION } from './utils/dataVersion.js';
import { sanitizeUserForSession } from './utils/cryptoAuth.js';
import './App.css';

function sanitizeProjectData(data) {
  if (!data) return data;
  const migrated = migrateProjectData(data);
  const clone = { ...migrated };
  
  // 產品階段：確保 mp 存在，遷移舊版 ecn 至新結構
  if (clone.basicInfo) {
    clone.basicInfo = { ...clone.basicInfo };
    clone.basicInfo.signOff = {
      ...(clone.basicInfo.signOff || {}),
      rdSignedAt: clone.basicInfo.signOff?.rdSignedAt || '',
      engineeringReviewSignedAt: clone.basicInfo.signOff?.engineeringReviewSignedAt || '',
      qaSignedAt: clone.basicInfo.signOff?.qaSignedAt || ''
    };
    const stage = clone.basicInfo.stage || {};
    const legacyEcn = clone.basicInfo._legacyEcn;
    if (stage.ecn !== undefined) {
      clone.basicInfo.ecnChange = { has: !!stage.ecn, no: !stage.ecn };
      delete stage.ecn;
    } else if (legacyEcn !== undefined) {
      clone.basicInfo.ecnChange = { has: !!legacyEcn, no: !legacyEcn };
    }
    delete clone.basicInfo._legacyEcn;
    // D-106: 必填題不替使用者預設回答
    if (clone.basicInfo.ecnChange === undefined) {
      clone.basicInfo.ecnChange = { has: false, no: false };
    }
    stage.mp = stage.mp ?? false;
    clone.basicInfo.stage = { ...stage };
  }
  
  if (clone.processControl) {
    clone.processControl = { ...clone.processControl };
    clone.processControl.smtFirstPiece = { ...(clone.processControl.smtFirstPiece || {}) };
    const legacyApertureRatio = clone.basicInfo?.tooling?.stencil?.apertureRatio;
    // D-149: 遷移舊開孔比例後立即刪除舊欄位，確保清空能被正確存檔
    if (!clone.processControl.smtFirstPiece.stencilApertureRatio && legacyApertureRatio) {
      clone.processControl.smtFirstPiece.stencilApertureRatio = legacyApertureRatio;
    }
    if (clone.basicInfo?.tooling?.stencil?.apertureRatio !== undefined) {
      delete clone.basicInfo.tooling.stencil.apertureRatio;
    }
    
    // 1. tempPoints
    if (clone.processControl.tempPoints) {
      if (!Array.isArray(clone.processControl.tempPoints)) {
        const arr = [];
        const obj = clone.processControl.tempPoints;
        for (let i = 0; i < 6; i++) {
          arr.push({
            id: i + 1,
            pos: obj[i]?.pos || '',
            desc: obj[i]?.desc || '',
            memo: obj[i]?.memo || ''
          });
        }
        clone.processControl.tempPoints = arr;
      } else {
        const arr = [...clone.processControl.tempPoints];
        while (arr.length < 6) {
          arr.push({ id: arr.length + 1, pos: '', desc: '', memo: '' });
        }
        clone.processControl.tempPoints = arr.map((item, idx) => ({
          id: idx + 1,
          pos: item.pos || '',
          desc: item.desc || '',
          memo: item.memo || ''
        }));
      }
    }
  }
  
  if (clone.trialReport) {
    clone.trialReport = { ...clone.trialReport };
    
    // 2. printRecords
    if (clone.trialReport.printRecords) {
      if (!Array.isArray(clone.trialReport.printRecords)) {
        const arr = [];
        const obj = clone.trialReport.printRecords;
        const keys = Object.keys(obj).filter(k => /^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
        keys.forEach(k => {
          arr.push({
            id: obj[k].id || (k + 1),
            name: obj[k].name || '',
            checked: !!obj[k].checked,
            date: obj[k].date || ''
          });
        });
        clone.trialReport.printRecords = arr;
      }
    }
    
    // 3. inspectRecords
    if (clone.trialReport.inspectRecords) {
      if (!Array.isArray(clone.trialReport.inspectRecords)) {
        const arr = [];
        const obj = clone.trialReport.inspectRecords;
        const keys = Object.keys(obj).filter(k => /^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
        keys.forEach(k => {
          arr.push({
            id: obj[k].id || (k + 1),
            name: obj[k].name || '',
            checked: !!obj[k].checked,
            date: obj[k].date || ''
          });
        });
        clone.trialReport.inspectRecords = arr;
      }
    }

    // 4. photoRecords
    if (clone.trialReport.photoRecords) {
      if (!Array.isArray(clone.trialReport.photoRecords)) {
        const arr = [];
        const obj = clone.trialReport.photoRecords;
        const keys = Object.keys(obj).filter(k => /^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
        keys.forEach(k => {
          const rawItem = obj[k] || {};
          let itemParts = rawItem.parts;
          if (!Array.isArray(itemParts)) {
            itemParts = itemParts ? Object.values(itemParts) : ['', '', '', ''];
          }
          while (itemParts.length < 4) itemParts.push('');
          arr.push({
            id: rawItem.id || (k + 1),
            name: rawItem.name || '',
            checked: !!rawItem.checked,
            date: rawItem.date || '',
            isXray: !!rawItem.isXray,
            parts: itemParts.map(String)
          });
        });
        // 合併被污染的外部 xray.parts
        const xrayData = obj.xray;
        if (xrayData && xrayData.parts) {
          const xrayParts = Array.isArray(xrayData.parts) ? xrayData.parts : Object.values(xrayData.parts);
          const xrayItem = arr.find(item => item.isXray);
          if (xrayItem) {
            for (let i = 0; i < 4; i++) {
              if (xrayParts[i]) xrayItem.parts[i] = String(xrayParts[i]);
            }
          }
        }
        clone.trialReport.photoRecords = arr;
      } else {
        clone.trialReport.photoRecords = clone.trialReport.photoRecords.map(item => {
          if (item.isXray) {
            let pts = item.parts;
            if (!Array.isArray(pts)) {
              pts = pts ? Object.values(pts) : ['', '', '', ''];
            }
            while (pts.length < 4) pts.push('');
            return { ...item, parts: pts.map(String) };
          }
          return item;
        });
      }
    }
  }
  
  return clone;
}

function sanitizeProjects(list) {
  if (!Array.isArray(list)) return [];
  return list.map(p => {
    if (p && p.data) {
      return { ...p, data: sanitizeProjectData(p.data), dataVersion: CURRENT_DATA_VERSION };
    }
    return p;
  });
}

const DEFAULT_FACTORIES = ['富士康', '捷普', '醫電鼎眾'];

const getProjectsKey = (user) => {
  if (!user) return 'ag_projects';
  if (user.role === 'admin') {
    return 'ag_projects_admin_test'; // 系統管理員最高權限測試資料庫，避免與部門正式數據混淆
  }
  return 'ag_projects';
};

// D-126: 帳號清單與加工廠主檔全系統共用，啟動時合併舊有的 _admin_test key
function migrateSharedKeys() {
  try {
    const legacyAdminAccounts = getJSON('accounts_admin_test', null);
    if (Array.isArray(legacyAdminAccounts) && legacyAdminAccounts.length > 0) {
      const mainAccounts = getJSON('accounts', []) || [];
      const merged = [...mainAccounts];
      legacyAdminAccounts.forEach((acc) => {
        if (!merged.some((m) => String(m.username).toLowerCase() === String(acc.username).toLowerCase())) {
          merged.push(acc);
        }
      });
      setJSON('accounts', merged);
      removeKey('accounts_admin_test');
    }

    const legacyAdminFactories = getJSON('factories_admin_test', null);
    if (Array.isArray(legacyAdminFactories) && legacyAdminFactories.length > 0) {
      const mainFactories = getJSON('factories', []) || [];
      const merged = Array.from(new Set([...mainFactories, ...legacyAdminFactories]));
      setJSON('factories', merged);
      removeKey('factories_admin_test');
    }
  } catch {
    /* 遷移例外忽略 */
  }
}

const normalizeFactories = (list) => {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map((fac) => String(fac || '').trim()).filter(Boolean)));
};

const getFactoriesCacheKey = () => {
  if (isSupabaseEnabled) return 'factories_cloud';
  return 'factories';
};

const getCachedFactories = () => {
  migrateSharedKeys();
  const cached = getJSON(getFactoriesCacheKey(), null);
  if (Array.isArray(cached)) return normalizeFactories(cached);
  return DEFAULT_FACTORIES;
};

// 雲端工作區(對應 storage suffix):admin 測試庫與正式庫分離
const getWorkspace = (user) => (user?.role === 'admin' ? 'admin_test' : 'default');

// D-01: 正式建置不含任何預設帳密 (R-1)
const DEFAULT_ACCOUNTS = [];

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '40px', textAlign: 'center' }}>
          <div className="glass-card" style={{ padding: '40px', maxWidth: '500px' }}>
            <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>系統發生錯誤</h2>
            <p style={{ marginBottom: '24px', color: '#6b7280' }}>請重新整理頁面或回到機種列表重新載入。</p>
            <button type="button" className="btn btn-primary" onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
              重新整理
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default function App() {
  const [projects, setProjects] = useState([]);
  const projectsRef = useRef([]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  // projects 目前內容所屬的 localStorage key(身分切換時用來擋住交叉寫入)
  const projectsKeyRef = useRef(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const currentProjectIdRef = useRef(null);
  useEffect(() => { currentProjectIdRef.current = currentProjectId; }, [currentProjectId]);
  const [data, setData] = useState(null);
  const [originalWb, setOriginalWb] = useState(null);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [highlightField, setHighlightField] = useState('');

  // 儲存狀態提示(信任訊號):idle | saving | saved
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const editedSinceLoadRef = useRef(false); // 區分「載入機種」與「使用者編輯」,避免開啟時誤顯示儲存中

  // P3 即時協作:對方更新提示 + 在線使用者
  const [remoteUpdate, setRemoteUpdate] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // E1/E2 — 雲端同步錯誤橫幅
  const [syncError, setSyncError] = useState(null);


  // 登入狀態與使用者管理
  const [currentUser, setCurrentUser] = useState(() => {
    return isSupabaseEnabled ? null : getJSON('current_user', null);
  });
  const [authReady, setAuthReady] = useState(!isSupabaseEnabled);
  const currentUserRef = useRef(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const [factories, setFactories] = useState(() => {
    return getCachedFactories(currentUser);
  });

  const [accounts, setAccounts] = useState(() => {
    migrateSharedKeys();
    const saved = getJSON('accounts', null);
    // 沒有存檔，或存檔為空陣列（被前次 session 清空）→ 用預設值填回，確保至少一個入口
    if (saved === null || (Array.isArray(saved) && saved.length === 0 && DEFAULT_ACCOUNTS.length > 0)) {
      return DEFAULT_ACCOUNTS;
    }
    return saved;
  });

  const currentAlignmentRate = useMemo(
    () => data ? validateAlignment(data).alignmentRate : 0,
    [data]
  );

  const sectionStatus = useMemo(
    () => data ? getWorkflowStatuses(data) : {},
    [data]
  );

  // 1. 初始化與讀取本地機種清單 (若清單為空，非同步下載預設範本)
  useEffect(() => {
    const loadDefaultTemplate = async () => {
      const key = getProjectsKey(currentUser);
      const list = getJSON(key.replace('ag_', ''), []);

      if (list.length === 0) {
        try {
          const response = await fetch(import.meta.env.BASE_URL + '新機種製作需求一覽表2026 v2.xlsx');
          if (!response.ok) throw new Error('無法載入範本 Excel 檔案。');
          const ab = await response.arrayBuffer();
          const parsedData = sanitizeProjectData(parseRequirementExcel(ab));
          
          const binaryString = new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), '');
          const base64 = btoa(binaryString);

          const defaultProj = {
            id: 'default-template',
            name: '新機種製作需求一覽表2026 v2.xlsx (預設範本)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            alignmentRate: 0,
            data: parsedData,
            originalWbBase64: base64
          };

          const newList = [defaultProj];
          setJSON(key.replace('ag_', ''), newList);
          projectsKeyRef.current = key;
          setProjects(newList);
        } catch (err) {
          if (import.meta.env.DEV) console.error('載入預設範本失敗:', err);
          setSyncError('載入預設範本失敗，請重新整理頁面。若持續發生，請確認網路連線。');
        }
      } else {
        projectsKeyRef.current = key;
        setProjects(sanitizeProjects(list));
      }
    };

    if (currentUser) {
      loadDefaultTemplate();
    }
  }, [currentUser]);

  // 1b. 雲端同步(僅在 Supabase 啟用時):登入後拉取雲端機種;雲端為空則把本機資料遷移上去
  useEffect(() => {
    if (!currentUser || !isSupabaseEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const ws = getWorkspace(currentUser);
        const localKey = getProjectsKey(currentUser).replace('ag_', '');
        const cloud = await pullProjects(ws);
        if (cancelled || !cloud) return;
        if (cloud.length > 0) {
          const sanitizedCloud = sanitizeProjects(cloud);
          projectsKeyRef.current = getProjectsKey(currentUser);
          setProjects(sanitizedCloud);
          setJSON(localKey, sanitizedCloud); // 同時更新本機離線快取
        } else {
          const local = getJSON(localKey, []);
          if (local.length > 0) {
            await migrateLocalProjects(ws, local, currentUser.id);
            if (cancelled) return; // E6 — 遷移後再次檢查
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[cloud] 雲端同步失敗,改用本機資料', e);
        // E2 — 同步失敗時顯示可見橫幅
        if (!cancelled) setSyncError('雲端同步失敗，目前使用本機資料。請確認網路連線。');
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // 1c. 委外加工廠主檔同步:雲端模式使用全系統共用資料表,localStorage 僅作離線快取
  useEffect(() => {
    if (!currentUser || !isSupabaseEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const localFactories = getCachedFactories(currentUser);
        const cloudFactories = await pullFactories();
        if (cancelled || !cloudFactories) return;
        if (cloudFactories.length > 0) {
          const normalizedCloud = normalizeFactories(cloudFactories);
          setFactories(normalizedCloud);
          setJSON(getFactoriesCacheKey(currentUser), normalizedCloud);
          return;
        }

        if (localFactories.length > 0) {
          const migrated = await migrateFactories(localFactories, currentUser?.id);
          if (cancelled) return;
          const normalizedMigrated = normalizeFactories(migrated.length > 0 ? migrated : localFactories);
          setFactories(normalizedMigrated);
          setJSON(getFactoriesCacheKey(currentUser), normalizedMigrated);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[cloud] 加工廠主檔同步失敗,改用本機快取', e);
        if (!cancelled) setSyncError('委外加工廠主檔雲端同步失敗，目前使用本機快取。請確認資料表已建立並檢查網路連線。');
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // 3a. 即時同步(P3):訂閱雲端機種變更 → 更新清單;目前開啟中且為「他人」更新則提示,不直接覆蓋
  useEffect(() => {
    if (!currentUser || !isSupabaseEnabled) return;
    const ws = getWorkspace(currentUser);
    const myId = currentUser.id;
    const unsub = subscribeProjects(ws, ({ eventType, new: row, old }) => {
      if (eventType === 'DELETE') {
        if (old?.id) setProjects(prev => prev.filter(p => p.id !== old.id));
        return;
      }
      if (!row || (row.updatedBy && row.updatedBy === myId)) return; // 略過自己造成的回音
      setProjects(prev => (prev.some(p => p.id === row.id)
        ? prev.map(p => (p.id === row.id ? row : p))
        : [...prev, row]));
      if (row.id === currentProjectIdRef.current) setRemoteUpdate(row);
    });
    return unsub;
  }, [currentUser]);

  // 3a-2. 即時同步共用委外加工廠主檔
  useEffect(() => {
    if (!currentUser || !isSupabaseEnabled) return;
    const myId = currentUser.id;
    const refreshFactories = () => {
      pullFactories()
        .then((cloudFactories) => {
          if (!cloudFactories) return;
          const normalized = normalizeFactories(cloudFactories);
          setFactories(normalized);
          setJSON(getFactoriesCacheKey(currentUser), normalized);
        })
        .catch((e) => {
          if (import.meta.env.DEV) console.warn('[cloud] 加工廠主檔重新拉取失敗', e);
          setSyncError('委外加工廠主檔更新失敗，請重新整理後再確認。');
        });
    };
    const unsub = subscribeFactories(({ eventType, new: row, old }) => {
      if (eventType === 'DELETE') {
        if (old?.name) {
          setFactories(prev => normalizeFactories(prev.filter(f => f !== old.name)));
        } else {
          refreshFactories();
        }
        return;
      }
      if (!row?.name || (row.updatedBy && row.updatedBy === myId)) return;
      setFactories(prev => normalizeFactories(prev.includes(row.name) ? prev : [...prev, row.name]));
    });
    return unsub;
  }, [currentUser]);

  // 3b. 在線狀態(P3):同一機種有誰正在檢視
  useEffect(() => {
    if (!currentUser || !currentProjectId || !isSupabaseEnabled) return;
    const unsub = subscribePresence(
      `presence:proj:${currentProjectId}`,
      { key: currentUser.id || currentUser.username, username: currentUser.username, unit: currentUser.unit },
      (users) => setOnlineUsers(users),
    );
    return () => { unsub(); setOnlineUsers([]); };
  }, [currentUser, currentProjectId]);

  // 2. 自動存檔功能 (提供即時與 Debounce 800ms 機制，D-153 單一寫入與版本號遞增)
  const saveProjectData = useCallback((projId, name, projData) => {
    if (!projId || !projData) return;
    const report = validateAlignment(projData);
    const user = currentUserRef.current;
    const storageKey = user ? getProjectsKey(user).replace('ag_', '') : null;

    if (storageKey) {
      const updateResult = updateStoredProject(storageKey, projId, (current) => {
        return {
          ...current,
          name: name || current.name,
          data: projData,
          alignmentRate: report.alignmentRate,
        };
      });

      if (updateResult.success && updateResult.project) {
        const nextList = getStoredProjects(storageKey);
        projectsRef.current = nextList;
        setProjects(nextList);

        // 雲端同步(關閉時 pushProject 為 no-op)
        if (isSupabaseEnabled && user) {
          pushProject(getWorkspace(user), updateResult.project, user?.id).catch(e => {
            if (import.meta.env.DEV) console.warn('[cloud] 上推失敗', e);
            setSyncError('雲端同步失敗，此筆變更目前僅儲存於本機。請確認網路連線。');
          });
        }
      } else if (updateResult.deleted) {
        setSyncError('此機種已被其他分頁或裝置刪除。');
      } else if (updateResult.conflict) {
        setSyncError('此機種已有較新的變更，請重新整理確認。');
      }
    }
  }, []);

  const debounceRef = useRef(null);
  const pendingSaveRef = useRef(null);

  const flushPendingSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { projId, name, projData } = pendingSaveRef.current;
      saveProjectData(projId, name, projData);
      pendingSaveRef.current = null;
    }
  }, [saveProjectData]);

  const flushPendingSaveRef = useRef(flushPendingSave);
  useEffect(() => { flushPendingSaveRef.current = flushPendingSave; }, [flushPendingSave]);

  useEffect(() => {
    if (currentProjectId && data) {
      // 機種「載入」時的第一次 data 設定不算編輯,不顯示儲存中
      if (!editedSinceLoadRef.current) {
        editedSinceLoadRef.current = true;
        return;
      }
      setSaveState('saving');
      pendingSaveRef.current = { projId: currentProjectId, name: fileName, projData: data };
      debounceRef.current = setTimeout(() => {
        saveProjectData(currentProjectId, fileName, data);
        pendingSaveRef.current = null;
        setSaveState('saved');
        setSavedAt(Date.now());
      }, 800);

      return () => clearTimeout(debounceRef.current);
    }
  }, [data, currentProjectId, fileName, saveProjectData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      flushPendingSaveRef.current();
      // U1 — 尚有未儲存變更時警告使用者
      if (saveState === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveState]);

  // 共用登出流程:先儲存當前編輯(write-through 落盤+上雲),再清除登入狀態與
  // 「上次開啟機種」記錄,避免共用工作站上下一位登入者自動開啟上一位的機種
  const handleLogout = async () => {
    // D-75: 僅在有未儲存的變更時才執行存檔，瀏覽不更新 updatedAt
    flushPendingSaveRef.current();
    try {
      const result = await signOut();
      if (result?.remoteRevoked === false && import.meta.env.DEV) {
        console.warn('[auth] 遠端 session 撤銷失敗，本機 session 已清除。', result.error);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] 本機 session 清除失敗', err);
    } finally {
      removeKey('current_user');
      setCurrentUser(null);
      setData(null);
      setOriginalWb(null);
      setFileName('');
      setCurrentProjectId(null);
      setActiveTab('dashboard');
      setRemoteUpdate(null);
      setSaveState('idle');
      removeKey('last_project_id');
      lastIdRef.current = null;
      setProjects([]);
    }
  };
  const handleLogoutRef = useRef(handleLogout);
  useEffect(() => { handleLogoutRef.current = handleLogout; });

  // D-157: 跨分頁協調 30 分鐘無操作自動登出與 2 分鐘倒數提示
  const [idleWarningSeconds, setIdleWarningSeconds] = useState(null);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    localStorage.setItem('ag_last_activity', String(now));
    setIdleWarningSeconds(null);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const TIMEOUT_MS = 30 * 60 * 1000;
    const WARNING_MS = 2 * 60 * 1000; // 倒數 2 分鐘

    // 初始化最後活動時間
    if (!localStorage.getItem('ag_last_activity')) {
      localStorage.setItem('ag_last_activity', String(Date.now()));
    }

    let lastWrite = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 15000) {
        lastWrite = now;
        localStorage.setItem('ag_last_activity', String(now));
      }
      setIdleWarningSeconds(null);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, handleUserActivity, { passive: true }));

    // 定期檢查跨分頁最後活動時間
    const intervalId = setInterval(() => {
      const now = Date.now();
      const lastAct = Number(localStorage.getItem('ag_last_activity') || String(now));
      const elapsed = now - lastAct;

      if (elapsed >= TIMEOUT_MS) {
        clearInterval(intervalId);
        setIdleWarningSeconds(null);
        void handleLogoutRef.current().finally(() => {
          setSyncError('因長時間無操作，已自動登出，請重新登入。');
        });
      } else if (elapsed >= TIMEOUT_MS - WARNING_MS) {
        const remainingSec = Math.max(1, Math.ceil((TIMEOUT_MS - elapsed) / 1000));
        setIdleWarningSeconds(remainingSec);
      } else {
        setIdleWarningSeconds(null);
      }
    }, 5000);

    // 跨分頁 storage 監聽 (登出同步與活動重設)
    const handleStorage = (e) => {
      if (e.key === 'ag_current_user' && !e.newValue && currentUserRef.current) {
        void handleLogoutRef.current().finally(() => {
          setSyncError('已於其他分頁登出。');
        });
      } else if (e.key === 'ag_last_activity') {
        setIdleWarningSeconds(null);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(intervalId);
      events.forEach(ev => window.removeEventListener(ev, handleUserActivity));
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser]);

  const factoriesCacheKeyRef = useRef(getFactoriesCacheKey(currentUser));
  useEffect(() => {
    const key = getFactoriesCacheKey(currentUser);
    if (key !== factoriesCacheKeyRef.current) {
      factoriesCacheKeyRef.current = key;
      setFactories(getCachedFactories(currentUser));
      return;
    }
    setJSON(key, normalizeFactories(factories));
  }, [factories, currentUser]);

  // D-126: 帳號清單全系統共用
  useEffect(() => {
    if (Array.isArray(accounts)) {
      setJSON('accounts', accounts);
    }
  }, [accounts]);

  useEffect(() => {
    if (currentUser) {
      // D-139: 存入 localStorage 前剔除明文密碼與雜湊敏感欄位
      const safeUser = sanitizeUserForSession(currentUser);
      setJSON('current_user', safeUser);
    } else {
      removeKey('current_user');
    }
  }, [currentUser]);

  // Supabase:啟動時以既有 session 還原登入,並監聽登入/登出狀態
  useEffect(() => {
    if (!isSupabaseEnabled) return;
    let cancelled = false;
    const syncSession = async () => {
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        setCurrentUser(user);
        if (!user) removeKey('current_user');
      } catch (err) {
        if (import.meta.env.DEV) console.error('[auth] 工作階段還原失敗', err);
        if (!cancelled) {
          removeKey('current_user');
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    void syncSession();
    const unsub = onAuthChange(() => { void syncSession(); });
    return () => { cancelled = true; unsub(); };
  }, []);


  // 自動恢復上次編輯的機種
  const lastIdRef = useRef(null);
  useEffect(() => {
    if (!currentUser || currentProjectId || projects.length === 0) return;
    const lastId = getJSON('last_project_id', null);
    if (lastId && lastId !== lastIdRef.current && projects.some(p => p.id === lastId)) {
      lastIdRef.current = lastId;
      const project = projects.find(p => p.id === lastId);
      if (project) {
        /* eslint-disable react-hooks/set-state-in-effect */
        editedSinceLoadRef.current = false;
        setSaveState('saved');
        setSavedAt(project.updatedAt ? Date.parse(project.updatedAt) : Date.now());
        setData(sanitizeProjectData(project.data));
        setFileName(project.name);
        /* eslint-enable react-hooks/set-state-in-effect */
        if (project.originalWbBase64) {
          try {
            const binaryString = atob(project.originalWbBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            setOriginalWb(XLSX.read(bytes.buffer, { type: 'array' }));
          } catch { setOriginalWb(null); } // D10 — 損毀的 base64 不讓整個載入失敗
        }
        setCurrentProjectId(lastId);
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, projects, currentProjectId]);

  const handleAddFactory = async (fac) => {
    const name = String(fac || '').trim();
    if (!name || factories.includes(name)) return;
    const snapshot = factories;
    const next = normalizeFactories([...factories, name]);
    setFactories(next);
    setJSON(getFactoriesCacheKey(currentUser), next);

    if (isSupabaseEnabled) {
      try {
        await addFactoryRemote(name, currentUser?.id);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[cloud] 新增加工廠主檔失敗', e);
        setFactories(snapshot);
        setJSON(getFactoriesCacheKey(currentUser), snapshot);
        setSyncError(`新增委外加工廠「${name}」雲端同步失敗，已還原。請確認網路連線後再試。`);
      }
    }
  };

  const handleRemoveFactory = async (fac) => {
    const name = String(fac || '').trim();
    if (!name) return;
    const snapshot = factories;
    const next = normalizeFactories(factories.filter(f => f !== name));
    setFactories(next);
    setJSON(getFactoriesCacheKey(currentUser), next);

    if (isSupabaseEnabled) {
      try {
        await deleteFactoryRemote(name);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[cloud] 刪除加工廠主檔失敗', e);
        setFactories(snapshot);
        setJSON(getFactoriesCacheKey(currentUser), snapshot);
        setSyncError(`刪除委外加工廠「${name}」雲端同步失敗，已還原。請確認網路連線後再試。`);
      }
    }
  };

  const handleAddAccount = (acc) => {
    setAccounts([...accounts, acc]);
  };

  const handleRemoveAccount = (uname) => {
    setAccounts(accounts.filter(a => a.username !== uname));
  };

  // 3. 選取機種並載入詳細資料
  const handleSelectProject = (id, currentList = projects) => {
    // 上一個機種還有未儲存的編輯(debounce 未觸發)時,先強制存檔,避免切換造成資料遺失
    flushPendingSaveRef.current();
    const project = currentList.find(p => p.id === id);
    if (project) {
      editedSinceLoadRef.current = false;
      setRemoteUpdate(null);
      setSaveState('saved');
      setSavedAt(project.updatedAt ? Date.parse(project.updatedAt) : Date.now());
      setData(sanitizeProjectData(project.data));
      setFileName(project.name);

      // 解析原始 Excel 二進位資料為 Workbook 物件
      if (project.originalWbBase64) {
        try { // D10 — 損毀的 base64 不讓選取失敗
          const binaryString = atob(project.originalWbBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          setOriginalWb(XLSX.read(bytes.buffer, { type: 'array' }));
        } catch { setOriginalWb(null); }
      } else {
        // 若無 base64 備份，先設為 null，由 SignOff 處理
        setOriginalWb(null);
      }
      
      setCurrentProjectId(id);
      setActiveTab('dashboard');
      setJSON('last_project_id', id);
      navigateTo('/projects/' + id);
    } else {
      setSyncError('找不到該機種資料。');
    }
  };

  // 4. 線上直接新增機種 (複製預設範本);回傳是否成功,失敗時呼叫端保留 Modal 讓使用者修正
  const handleCreateProject = async (name) => {
    if (!name || !name.trim()) return false;
    const trimmedName = name.trim();

    // 防呆設計：防範重複機種名稱
    const isDuplicate = projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setSyncError(`已存在名稱為「${trimmedName}」的機種，請使用其他名稱！`);
      return false;
    }

    try {
      // 嘗試複製列表中的預設範本，如果沒有則重新拉取 Excel 檔
      let base64 = '';
      let parsedData = null;
      const template = projects.find(p => p.id === 'default-template');
      
      if (template) {
        base64 = template.originalWbBase64;
        try {
          parsedData = JSON.parse(JSON.stringify(template.data));
        } catch {
          parsedData = null;
        }
      } else {
        const response = await fetch(import.meta.env.BASE_URL + '新機種製作需求一覽表2026 v2.xlsx');
        if (!response.ok) throw new Error('無法載入範本');
        const ab = await response.arrayBuffer();
        parsedData = sanitizeProjectData(parseRequirementExcel(ab));
        const binaryString = new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), '');
        base64 = btoa(binaryString);
      }

      const newProj = {
        id: 'proj_' + crypto.randomUUID(),
        name: trimmedName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        alignmentRate: 0,
        data: sanitizeProjectData(parsedData),
        originalWbBase64: base64,
        version: 1,
      };

      const storageKey = getProjectsKey(currentUser).replace('ag_', '');
      insertStoredProject(storageKey, newProj);
      const newList = getStoredProjects(storageKey);
      projectsRef.current = newList;
      setProjects(newList);
      if (isSupabaseEnabled) pushProject(getWorkspace(currentUser), newProj, currentUser?.id).catch(e => { if (import.meta.env.DEV) console.warn('[cloud] 新增上推失敗', e); });

      handleSelectProject(newProj.id, newList);
      return true;
    } catch (err) {
      console.error(err);
      setSyncError('建立新機種失敗！');
      return false;
    }
  };

  // 5. 匯入 Excel 機種
  const handleImportExcel = async (name, fileBase64) => {
    if (!name || !name.trim()) return;
    const trimmedName = name.trim();

    // 防呆設計：防範重複機種名稱
    const isDuplicate = projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setSyncError(`已存在名稱為「${trimmedName}」的機種，請更換檔案名稱後重新上傳！`);
      return;
    }

    try {
      // 在前端解析 base64 檔案
      const binaryString = atob(fileBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const parsedData = sanitizeProjectData(parseRequirementExcel(bytes.buffer));

      const newProj = {
        id: 'proj_' + crypto.randomUUID(),
        name: name || `未命名機種_${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        alignmentRate: 0,
        data: parsedData,
        originalWbBase64: fileBase64,
        version: 1,
      };

      const storageKey = getProjectsKey(currentUser).replace('ag_', '');
      insertStoredProject(storageKey, newProj);
      const newList = getStoredProjects(storageKey);
      projectsRef.current = newList;
      setProjects(newList);
      if (isSupabaseEnabled) pushProject(getWorkspace(currentUser), newProj, currentUser?.id).catch(e => { if (import.meta.env.DEV) console.warn('[cloud] 匯入上推失敗', e); });

      handleSelectProject(newProj.id, newList);
    } catch (err) {
      console.error(err);
      setSyncError('解析或匯入 Excel 失敗，請確認檔案格式是否正確。');
    }
  };

  // 6. 刪除機種
  const handleDeleteProject = async (id) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    // D2 — 刪除（已由清單操作端進行確認）
    const storageKey = getProjectsKey(currentUser).replace('ag_', '');
    const snapshot = getStoredProjects(storageKey);
    deleteStoredProject(storageKey, id);
    const newList = getStoredProjects(storageKey);
    projectsRef.current = newList;
    setProjects(newList);

    if (currentProjectId === id) {
      handleBackToList();
    }

    if (isSupabaseEnabled) {
      try {
        await deleteProjectRemote(id);
      } catch (e) {
        if (import.meta.env.DEV) console.error('[cloud] 刪除失敗', e);
        // D2 — 雲端刪除失敗時還原本機清單
        setJSON(storageKey, snapshot);
        projectsRef.current = snapshot;
        setProjects(snapshot);
        setSyncError('雲端刪除失敗，機種已恢復。請確認網路連線後再試。');
      }
    }
  };

  const handleBackToList = () => {
    // D-75: 僅在有未儲存的變更時強制同步存檔，純瀏覽不更新 updatedAt
    flushPendingSaveRef.current();
    setSaveState('saved');
    setData(null);
    setOriginalWb(null);
    setFileName('');
    setCurrentProjectId(null);
    setActiveTab('dashboard');
    setRemoteUpdate(null);
    navigateTo('/projects');
  };

  // P3:把對方的最新版本載入編輯器(使用者主動確認,避免靜默覆蓋編輯中內容)
  const handleLoadRemote = () => {
    if (!remoteUpdate) return;
    editedSinceLoadRef.current = false;
    setData(sanitizeProjectData(remoteUpdate.data));
    setFileName(remoteUpdate.name);
    if (remoteUpdate.originalWbBase64) {
      try {
        const bin = atob(remoteUpdate.originalWbBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        setOriginalWb(XLSX.read(bytes.buffer, { type: 'array' }));
      } catch { /* 還原失敗忽略 */ }
    }
    setSaveState('saved');
    setSavedAt(remoteUpdate.updatedAt ? Date.parse(remoteUpdate.updatedAt) : Date.now());
    setRemoteUpdate(null);
  };

  const handleExportComplete = () => {
    // 匯出成功狀態已改由 SignOff 頁內元件就地呈現 (M4 去彈窗化)
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (!currentProjectIdRef.current) {
      if (tab === 'settings') navigateTo('/settings/factories');
      return;
    }
    if (tab === 'dashboard') {
      navigateTo('/projects/' + currentProjectIdRef.current);
    } else if (tab === 'settings') {
      navigateTo('/settings/factories');
    } else if (TAB_TO_STEP_KEY[tab]) {
      navigateTo('/projects/' + currentProjectIdRef.current + '/' + TAB_TO_STEP_KEY[tab]);
    }
  };

  const handleGoToSection = (tab, msg) => {
    handleTabChange(tab);
    if (msg) {
      setHighlightField(msg);
      setTimeout(() => {
        setHighlightField('');
      }, 3000);
    }
  };

  // 路由同步 (響應瀏覽器上一頁/下一頁與手動切換 Hash)
  const handleBackToListRef = useRef(handleBackToList);
  const handleSelectProjectRef = useRef(handleSelectProject);
  useEffect(() => {
    handleBackToListRef.current = handleBackToList;
    handleSelectProjectRef.current = handleSelectProject;
  });

  // 初次載入或重新整理時，若 URL 帶有專案 ID 且尚未載入該專案，自動選取該機種
  const initialRouteCheckedRef = useRef(false);
  useEffect(() => {
    if (!initialRouteCheckedRef.current && projects.length > 0) {
      initialRouteCheckedRef.current = true;
      const r = parseHash();
      if ((r.route === 'project-overview' || r.route === 'project-step' || r.route === 'project-print') && r.params.id) {
        const found = projects.find(p => p.id === r.params.id);
        if (found) {
          const targetId = r.params.id;
          setTimeout(() => {
            handleSelectProjectRef.current(targetId, projects);
            if (r.route === 'project-print') setActiveTab('print');
          }, 0);
        }
      }
    }
  }, [projects]);

  useEffect(() => {
    const handleHash = () => {
      const current = parseHash();
      if (!currentUserRef.current) return;

      if (current.route === 'projects') {
        if (currentProjectIdRef.current) {
          handleBackToListRef.current();
        }
      } else if (current.route === 'project-print') {
        const projId = current.params.id;
        if (projId && projId !== currentProjectIdRef.current) {
          handleSelectProjectRef.current(projId);
        }
        setActiveTab('print');
      } else if (current.route === 'project-overview') {
        const projId = current.params.id;
        if (projId && projId !== currentProjectIdRef.current) {
          handleSelectProjectRef.current(projId);
        }
        setActiveTab('dashboard');
      } else if (current.route === 'project-step') {
        const projId = current.params.id;
        if (projId && projId !== currentProjectIdRef.current) {
          handleSelectProjectRef.current(projId);
        }
        if (current.params.tabKey) {
          setActiveTab(current.params.tabKey);
        }
      } else if (current.route === 'settings-factories' || current.route === 'settings-users') {
        setActiveTab('settings');
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 動態網頁標題同步 (規格 6.2 規則 5)
  useEffect(() => {
    if (!currentUser) {
      document.title = '登入 ｜ 產品委外加工系統';
    } else if (!currentProjectId) {
      document.title = '機種管理中心 ｜ 產品委外加工系統';
    } else {
      const stepName = WORKFLOW_STEPS.find(s => s.key === activeTab)?.label || (activeTab === 'dashboard' ? '儀表板' : '設定');
      document.title = `${fileName || '機種'} ｜ ${stepName} ｜ 產品委外加工系統`;
    }
  }, [currentUser, currentProjectId, activeTab, fileName]);

  const handleUpdateAccountLevel = (uname, newLevel) => {
    setAccounts(prev => prev.map(a =>
      a.username === uname ? { ...a, level: newLevel } : a
    ));
  };

  const handleUpdateAccountSignature = (uname, signature) => {
    setAccounts(prev => prev.map(a =>
      a.username === uname ? { ...a, signature } : a
    ));
    if (currentUser && currentUser.username === uname) {
      setCurrentUser(prev => ({ ...prev, signature }));
      // 雲端模式:寫回 Supabase profile;否則 token 刷新或重新登入後簽章會遺失
      if (isSupabaseEnabled) {
        updateMySignature(signature).catch((e) => {
          if (import.meta.env.DEV) console.warn('[auth] 簽章雲端同步失敗', e);
          setSyncError('簽章已套用，但雲端同步失敗；重新登入後可能需要重新上傳簽章。');
        });
      }
    }
  };

  // 渲染分頁
  const renderTabContent = () => {
    if (!data) return null;
    const nextWorkflowStep = getNextWorkflowStep(activeTab);
    
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard data={data} onGoToSection={handleGoToSection} sectionStatus={sectionStatus} currentUser={currentUser} />;
      case 'basicInfo':
      case 'qualityProcess':
      case 'tooling':
      case 'preparation':
      case 'thermalProfile':
      case 'smtControl':
      case 'dipSpecialProcess':
      case 'trialReport':
      case 'documents':
        return (
          <FormSections 
            data={data} 
            activeSection={activeTab}
            onChange={setData} 
            onNext={() => nextWorkflowStep && setActiveTab(nextWorkflowStep)}
            currentUser={currentUser}
            factories={factories}
            highlightField={highlightField}
          />
        );
      case 'signOff':
        return (
          <SignOff 
            data={data} 
            originalWb={originalWb} 
            fileName={fileName}
            onChange={setData} 
            onExportComplete={handleExportComplete} 
            currentUser={currentUser}
            onUpdateAccountSignature={handleUpdateAccountSignature}
            onFinalExit={handleLogout}
            onFinalBackToList={handleBackToList}
          />
        );
      case 'settings':
        return (
          <Settings
            factories={factories}
            onAddFactory={handleAddFactory}
            onRemoveFactory={handleRemoveFactory}
            accounts={accounts}
            onAddAccount={handleAddAccount}
            onRemoveAccount={handleRemoveAccount}
            onUpdateAccountLevel={handleUpdateAccountLevel}
            onUpdateAccountSignature={handleUpdateAccountSignature}
            currentUser={currentUser}
          />
        );
      case 'account':
        return (
          <AccountSettings
            currentUser={currentUser}
            onUpdateAccountSignature={handleUpdateAccountSignature}
          />
        );
      case 'print':
        return (
          <div className="print-preview-wrapper" style={{ padding: '16px', maxWidth: '1024px', margin: '0 auto' }}>
            <div className="print-preview-actions" style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigateTo(`/projects/${currentProjectId}/sign-off`)}
              >
                ← 返回簽核
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                🖨️ 列印 / 另存 PDF
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.share({
                      title: `${fileName || '機種'}_列印報表`,
                      text: `產品委外加工需求一覽表 - ${fileName || ''}`,
                      url: window.location.href,
                    }).catch(() => {});
                  }}
                >
                  📤 分享
                </button>
              )}
            </div>
            <div className="print-preview-sheet" style={{ background: '#fff', color: '#000', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <PrintReport data={data} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!authReady) {
    return (
      <div className="auth-loading-screen" role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg, #f8fafc)', padding: '24px' }}>
        <div className="auth-card glass-card animate-fade-in" style={{ padding: '32px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <span className="login-logo-icon" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🔐</span>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>正在驗證工作階段…</h2>
          <p style={{ color: 'var(--c-text-2, #64748b)', fontSize: '0.9rem' }}>請稍候，系統正在確認雲端登入狀態。</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginModal onLogin={setCurrentUser} accounts={accounts} />
    );
  }

  return (
    <>
      {data && (
        <Suspense fallback={null}>
          <PrintReport data={data} />
        </Suspense>
      )}
      <ErrorBoundary>
        <AppShell
        currentUser={currentUser}
        onLogout={handleLogout}
        inProject={!!currentProjectId}
        projectName={fileName}
        onBackToList={handleBackToList}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        sectionStatus={sectionStatus}
        alignmentRate={currentAlignmentRate}
        saveState={saveState}
        savedAt={savedAt}
        onlineCount={onlineUsers.length}
      >
        {/* E1/E2/U10 — 雲端同步或儲存錯誤橫幅 */}
        {syncError && (
          <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '8px 14px', margin: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fbbf24', gap: '12px' }}>
            <span>⚠️ {syncError}</span>
            <button type="button" onClick={() => setSyncError(null)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} aria-label="關閉">✕</button>
          </div>
        )}

        {/* D-157: 閒置登出倒數 2 分鐘橫幅 */}
        {idleWarningSeconds !== null && (
          <div role="alert" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', padding: '10px 16px', margin: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ef4444', gap: '12px' }}>
            <span>⏳ 由於長時間未操作，系統將於 <strong>{idleWarningSeconds}</strong> 秒後自動登出以保護資料安全。</span>
            <button type="button" className="btn btn-primary btn-xs" onClick={resetActivity}>繼續使用</button>
          </div>
        )}

        {activeTab === 'account' ? (
          <div className="tab-content animate-fade-in">
            <AccountSettings
              currentUser={currentUser}
              onUpdateAccountSignature={handleUpdateAccountSignature}
            />
          </div>
        ) : activeTab === 'settings' ? (
          <div className="tab-content animate-fade-in">
            <Settings
              factories={factories}
              onAddFactory={handleAddFactory}
              onRemoveFactory={handleRemoveFactory}
              accounts={accounts}
              onAddAccount={handleAddAccount}
              onRemoveAccount={handleRemoveAccount}
              onUpdateAccountLevel={handleUpdateAccountLevel}
              onUpdateAccountSignature={handleUpdateAccountSignature}
              currentUser={currentUser}
            />
          </div>
        ) : !currentProjectId ? (
          <ProjectList
            projects={projects}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onImportExcel={handleImportExcel}
          />
        ) : (
          <>
            {remoteUpdate && (
              <div className="remote-update-banner animate-fade-in">
                <span className="rub-text">☁ 協作者剛更新了此機種的資料</span>
                <span className="rub-actions">
                  <button type="button" className="btn btn-primary btn-xs" onClick={handleLoadRemote}>載入最新</button>
                  <button type="button" className="rub-dismiss" onClick={() => setRemoteUpdate(null)}>稍後</button>
                </span>
              </div>
            )}
            <div className="tab-content animate-fade-in">
              {renderTabContent()}
            </div>
          </>
        )}

        {/* 頁尾(瘦身,credit 移出黃金區) */}
        <footer className="app-footer">
          <p>© 2026 醫電鼎眾股份有限公司</p>
        </footer>
      </AppShell>
      </ErrorBoundary>
    </>
  );
}








