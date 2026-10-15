/**
 * 簽核聲明統一常數 (D-156, OD-57)
 * 網頁、列印報表與伺服器端簽核證據共用此常數
 * 研發部門依 OD-57 預設使用「確認」
 */

export const SIGN_ATTESTATIONS = {
  rd: '本簽章確認：產品基本資料與風險零件已填寫完整，並經研發部門確認。',
  eng: '本簽章確認：生產製程參數與治工具需求已評估確認，符合量產導入標準。',
  qa: '本簽章確認：品質檢驗標準與試產驗收條件已核准，同意依此規範進行委外加工。'
};

/**
 * 取得移除前綴後的精簡聲明 (供列印或特定版面使用)
 * @param {'rd' | 'eng' | 'qa'} role 
 * @returns {string}
 */
export function getAttestationBody(role) {
  const full = SIGN_ATTESTATIONS[role] || '';
  return full.replace(/^本簽章確認：/, '');
}
