/**
 * 鋼板開孔比例正規化工具 (D-142, D-149, D-160)
 * 統一處理開孔比例之輸入字串，去除全形字元、百分比符號與額外空格
 */

/**
 * 正規化開孔比例數值
 * @param {string|number|null|undefined} val 
 * @returns {string} 純數字字串（例如 '100'）或空字串 ''
 */
export function normalizeApertureRatio(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';

  // 全形數字轉半形
  str = str.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

  // 清除常見前綴與符號
  str = str
    .replace(/[☑☐]/g, '')
    .replace(/鋼板開孔比例[（(]錫膏印刷[）)][:：]?/g, '')
    .replace(/開[孔口]比[例]?[:：]?/g, '')
    .replace(/%/g, '')
    .trim();

  return str;
}

/**
 * 格式化開孔比例顯示字串 (D-142, D-160)
 * @param {string|number|null|undefined} val 
 * @returns {string} 如 '100%' 或 '(未填寫)'
 */
export function formatApertureRatio(val) {
  const norm = normalizeApertureRatio(val);
  if (!norm) return '(未填寫)';
  return `${norm}%`;
}
