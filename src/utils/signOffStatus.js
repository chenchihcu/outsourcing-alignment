/**
 * 簽核完成狀態判定工具 (D-116)
 * 統一全系統判定簽核是否真正完成之單一真本函式
 */

import { isWorkflowComplete } from './workflow.js';

/**
 * 判定機種資料是否完成最終簽核
 * 條件：
 * 1. RD、PE、QA 三方均已簽章 (OD-13: 需完整三方)
 * 2. 目前沒有進行中之退件 (無 active rejection)
 * 3. 所有適用步驟皆已完成填寫 (不含簽核步驟本身)
 * 
 * @param {Object} projectData 
 * @returns {boolean}
 */
export function isSignOffComplete(projectData) {
  if (!projectData) return false;

  const sign = projectData.basicInfo?.signOff || {};

  // 1. 檢查退件狀態
  if (sign.rejection && sign.rejection.rejected) {
    return false;
  }

  // 2. 檢查三方簽章（必須三方全部具備有效簽章資料）
  const hasRd = Boolean(sign.rdSignature);
  const hasEng = Boolean(sign.engineeringReviewSignature);
  const hasQa = Boolean(sign.qaSignature);

  if (!hasRd || !hasEng || !hasQa) {
    return false;
  }

  // 3. 檢查前置適用步驟是否全部完成
  if (!isWorkflowComplete(projectData)) {
    return false;
  }

  return true;
}

/**
 * 取得尚未完成之簽核與防呆缺項清單 (供 UI 提示)
 * @param {Object} projectData 
 * @returns {string[]}
 */
export function getSignOffMissingItems(projectData) {
  if (!projectData) return ['專案資料為空'];

  const missing = [];
  const sign = projectData.basicInfo?.signOff || {};

  if (sign.rejection && sign.rejection.rejected) {
    missing.push('機種已被退件，需完成修正並重新送審');
  }

  if (!sign.rdSignature) missing.push('研發 (RD) 尚未簽章');
  if (!sign.engineeringReviewSignature) missing.push('工程 (PE) 尚未簽章');
  if (!sign.qaSignature) missing.push('品保 (QA) 尚未簽章');

  if (!isWorkflowComplete(projectData)) {
    missing.push('尚有前置必填表單步驟未完成');
  }

  return missing;
}
