/**
 * 驗證發包方與委外加工廠的填寫資料，計算對齊率與列出警示資訊 (D-21, D-142, D-149, D-155)
 * @param {Object} data - parseRequirementExcel 解析後的資料
 * @returns {Object} 包含對齊率、警示清單及詳細欄位狀態
 */

import { normalizeApertureRatio } from './normalizeApertureRatio.js';

export function validateAlignment(data) {
  const warnings = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const check = (condition, warningMsg, type = 'error', stepKey = 'basicInfo', fieldKey = '', owner = 'any') => {
    totalChecks++;
    if (condition) {
      passedChecks++;
      return true;
    } else {
      warnings.push({ type, message: warningMsg, stepKey, fieldKey, owner });
      return false;
    }
  };

  // --- 發包方 (研發/工程) 填寫檢核 ---
  const bi = data?.basicInfo || {};
  const pi = bi.processItems || {};
  check(!!bi.productNo, '未填寫「產品料號」', 'error', 'basicInfo', 'productNo', 'rd');
  check(!!bi.productDesc, '未填寫「產品名稱 / 描述」', 'error', 'basicInfo', 'productDesc', 'rd');

  // 產品階段至少勾選一個
  const stage = bi.stage || {};
  const hasStage = stage.evt || stage.dvt || stage.pvt || stage.politRun || stage.mp;
  check(hasStage, '未勾選「產品階段」（EVT / DVT / PVT / Pilot-run / MP）', 'error', 'basicInfo', 'stage', 'rd');

  // --- 委外加工廠回填檢核 (公共欄位) ---
  check(!!(bi.factory || '').trim(), '未填寫「委外加工廠」名稱', 'error', 'basicInfo', 'factory', 'any');

  // 主要加工項目：至少勾選一項 (D-21)
  const hasAnyProcess = Object.values(pi).some(Boolean);
  check(hasAnyProcess, '未選擇任何「主要加工項目」', 'error', 'qualityProcess', 'processItems', 'rd');
  if (pi.otherProcess) {
    check(!!(pi.otherProcessText || '').trim(), '已勾選「其他加工」，但未填寫說明文字', 'error', 'qualityProcess', 'otherProcessText', 'rd');
  }

  // 烘烤參數確認
  const pc = data?.processControl || {};
  const bake = pc.bakeRequired || {};
  const hasBakeSelect = bake.need || bake.noNeed;
  check(hasBakeSelect, '未確認是否需要「PCB / FPCA 烘烤」', 'error', 'preparation', 'bakeRequired', 'eng');
  
  if (bake.need) {
    const pcbValid = !!bake.pcbBakeTemp && !!bake.pcbBakeTol && !!bake.pcbBakeHr;
    check(pcbValid, '已勾選需要烘烤，但未填妥「PCB 烘烤條件」數值（溫度 / 容差 / 時間）', 'error', 'preparation', 'bakeRequired', 'eng');
    const fpcaValid = !!bake.fpcaBakeTemp && !!bake.fpcaBakeHr;
    check(fpcaValid, '已勾選需要烘烤，但未填妥「FPCA 烘烤條件」數值（溫度 / 時間）', 'error', 'preparation', 'bakeRequired', 'eng');
  }

  const tooling = bi.tooling || {};
  if (pi.smt) {
    const stencil = tooling.stencil || {};
    const thickStr = String(stencil.thickness || '');
    const apertureRatio = normalizeApertureRatio(pc.smtFirstPiece?.stencilApertureRatio || '');
    check(!!stencil.thickness && !thickStr.includes('____'), '未填寫鋼板「厚度」', 'error', 'tooling', 'stencil', 'eng');
    check(!!apertureRatio, '未填寫「鋼板開孔比例（錫膏印刷）」', 'error', 'smtControl', 'stencilApertureRatio', 'eng');
    if (apertureRatio) {
      const numRatio = Number(apertureRatio);
      check(numRatio >= 50 && numRatio <= 120, '鋼板開孔比例需介於 50% 至 120% 之間', 'error', 'smtControl', 'stencilApertureRatio', 'eng');
    }
    const hasType = ['general', 'step'].includes(stencil.style);
    check(hasType, '未選擇鋼板樣式「一般鋼板 / 階梯鋼板」', 'error', 'tooling', 'stencil', 'eng');
  }

  // 治具對齊：若加工項目需要，應確認治具
  const checkFixture = (fixture, name, fieldKey) => {
    const hasFixtureConfirm = fixture?.need || fixture?.noNeed;
    check(hasFixtureConfirm, `未確認「${name}」是否需要或提供`, 'error', 'tooling', fieldKey, 'eng');
    if (fixture?.need) {
      const qtyStr = String(fixture.qty || '');
      check(!!fixture.qty && !qtyStr.includes('__'), `已確認需要「${name}」，但未填寫數量`, 'error', 'tooling', fieldKey, 'eng');
    }
  };
  checkFixture(tooling.routingFixture, 'Routing 治具', 'routingFixture');
  checkFixture(tooling.glueFixture, '塗膠治具', 'glueFixture');
  checkFixture(tooling.testFixture, '測試治具', 'testFixture');
  checkFixture(tooling.assemblyFixture, '組裝治具', 'assemblyFixture');

  // 新增治具校驗
  const smtCarrier = tooling.smtCarrier || {};
  const hasCarrierConfirm = smtCarrier.need || smtCarrier.noNeed;
  check(hasCarrierConfirm, '未確認「SMT 刷錫載具」是否需要', 'error', 'tooling', 'smtCarrier', 'eng');
  if (smtCarrier.need) {
    const hasCarrierOption = smtCarrier.upper || smtCarrier.lower;
    check(hasCarrierOption, '已勾選需要「SMT 刷錫載具」，但未選擇「上載板」或「下載板」', 'error', 'tooling', 'smtCarrier', 'eng');
  }

  const otherFixture = tooling.otherFixture || {};
  const hasOtherConfirm = otherFixture.need || otherFixture.noNeed;
  check(hasOtherConfirm, '未確認「其他治具」是否需要', 'error', 'tooling', 'otherFixture', 'eng');
  if (otherFixture.need) {
    const otherNameStr = String(otherFixture.name || '');
    const otherQtyStr = String(otherFixture.qty || '');
    check(!!otherFixture.name && !otherNameStr.includes('___'), '已勾選需要「其他治具」，但未填寫治具名稱', 'error', 'tooling', 'otherFixture', 'eng');
    check(!!otherFixture.qty && !otherQtyStr.includes('__'), '已勾選需要「其他治具」，但未填寫治具數量', 'error', 'tooling', 'otherFixture', 'eng');
  }

  // SMT/DIP 首件檢查與樣品提供
  const hasSample = pc.sampleProvided?.trialBoard || pc.sampleProvided?.tempBoard || pc.sampleProvided?.standardPart;
  check(hasSample, '未勾選任何提供的「樣品種類」（試錫板 / 測溫板 / 標準件）', 'error', 'preparation', 'sampleProvided', 'eng');

  // 僅當勾選 SMT 時才檢查 SMT 相關項目 (D-21)
  if (pi.smt) {
    const smtFirst = pc.smtFirstPiece || {};
    const hasSmtFirst = smtFirst.polarity || smtFirst.measureLcr || smtFirst.spi || smtFirst.steelTension || (smtFirst.ledTest === 'yes' || smtFirst.ledTest === 'no') || smtFirst.pcbReflow || smtFirst.solderability;
    check(hasSmtFirst, '未確認「SMT 首件檢查」項目（極性方向 / LCR量測 / SPI / 鋼板張力量測 / LED點亮測試 / PCB外觀檢查 / 濕潤性檢查）', 'error', 'smtControl', 'smtFirstPiece', 'eng');

    const hasLedTest = smtFirst.ledTest === 'yes' || smtFirst.ledTest === 'no';
    check(hasLedTest, '未確認 SMT「LED點亮測試」為「有」或「無 (不適用)」', 'error', 'smtControl', 'ledTest', 'eng');

    const smtOrder = pc.smtOrder || {};
    const hasSmtOrder = smtOrder.bToT || smtOrder.tToB;
    check(hasSmtOrder, '未確認「SMT 焊接順序」（先焊底面 / 先焊頂面）', 'error', 'smtControl', 'smtOrder', 'eng');
  }

  // 僅當勾選 DIP 時才檢查 DIP 相關項目 (D-21)
  if (pi.dip) {
    const dipFirst = pc.dipFirstPiece || {};
    check(dipFirst.cutLead, '未勾選 DIP 首件「剪腳前置作業」', 'error', 'dipSpecialProcess', 'dipFirstPiece', 'eng');
    if (dipFirst.memo) {
      check(dipFirst.memo.length <= 50, 'DIP 注意事項字數不得超過 50 字', 'error', 'dipSpecialProcess', 'dipFirstPiece', 'eng');
    }

    const dipOrder = pc.dipOrder || {};
    const hasDipOrder = dipOrder.bToT || dipOrder.tToB;
    check(hasDipOrder, '未確認「DIP 焊接順序」', 'error', 'dipSpecialProcess', 'dipOrder', 'eng');
  }

  // 測溫點配置：如果有關鍵零件，至少需填寫 1 個測溫點
  const hasKeyParts = pc.keyParts?.has;
  if (hasKeyParts) {
    const rawPoints = pc.tempPoints || [];
    const tempPoints = Array.isArray(rawPoints) ? rawPoints : Object.values(rawPoints);
    const validPoints = tempPoints.filter(p => !!p?.pos);
    check(validPoints.length >= 1, '已勾選有關鍵零件，但尚未填寫任何「測溫點」位置', 'warning', 'thermalProfile', 'tempPoints', 'eng');
  }

  // 包材種類 (僅能選擇 PCBA 或 FPCA 其中一種)
  const pkgType = pc.packagingType;
  check(!!pkgType, '未選擇「包材種類」（PCBA 包材 / FPCA 包材）', 'error', 'preparation', 'pcbaPackaging', 'eng');
  if (pkgType === 'pcba') {
    const pcbaPkg = pc.pcbaPackaging || {};
    const hasPcbaPkg = pcbaPkg.staticBag || pcbaPkg.honeycomb || pcbaPkg.tray || pcbaPkg.sensorCover || pcbaPkg.cameraCover;
    check(hasPcbaPkg, '已選 PCBA 包材，但未勾選任何「PCBA 包材」項目（靜電袋 / 蜂巢 / 脆盤 / 保護貼）', 'error', 'preparation', 'pcbaPackaging', 'eng');
  }
  if (pkgType === 'fpca') {
    const fpcaPkg = pc.fpcaPackaging || {};
    const hasFpcaPkg = fpcaPkg.staticBag || fpcaPkg.honeycomb || fpcaPkg.tray || fpcaPkg.sensorCover || fpcaPkg.cameraCover;
    check(hasFpcaPkg, '已選 FPCA 包材，但未勾選任何「FPCA 包材」項目（靜電袋 / 蜂巢 / 脆盤 / 保護貼）', 'error', 'preparation', 'fpcaPackaging', 'eng');
  }

  // D-21 & 7B.9.8 Rule 8: 簽章不列為表單未填寫 error，避免簽核死結

  // 計算對齊率
  const alignmentRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return {
    alignmentRate,
    passedChecks,
    totalChecks,
    warnings
  };
}
