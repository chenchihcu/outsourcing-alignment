/**
 * 驗證發包方與委外加工廠的填寫資料，計算對齊率與列出警示資訊 (D-21, D-142, D-149, D-155)
 * 基於 src/utils/rules/index.js 單一真本規則庫
 * @param {Object} data - 機種資料
 * @returns {{ alignmentRate: number, passedChecks: number, totalChecks: number, warnings: Array }}
 */

import { evaluateAllRules } from './rules/index.js';

export function validateAlignment(data) {
  return evaluateAllRules(data);
}
