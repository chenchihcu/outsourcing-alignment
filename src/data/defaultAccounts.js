/**
 * 預設系統帳號清單 (D-02, D-135)
 * 當本機尚未建立帳號或雲端遠端使用者尚未初始化時，作為基礎進入點。
 * 登入時會自動透過 PBKDF2 安全校驗並遷移為雜湊存儲。
 */
export const DEFAULT_ACCOUNTS = [
  { username: 'admin', password: 'admin123', unit: '管理處', role: 'admin', level: 'Administrator' },
  { username: 'rd', password: 'rd123', unit: '研發單位', role: 'rd', level: 'Standard' },
  { username: 'eng', password: 'eng123', unit: '工程單位', role: 'eng', level: 'Standard' },
  { username: 'qa', password: 'qa123', unit: '審核單位(品保處)', role: 'qa', level: 'Standard' },
  { username: 'guest', password: 'guest123', unit: '測試單位', role: 'guest', level: 'Guest' },
];
