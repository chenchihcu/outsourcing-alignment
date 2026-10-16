export const CURRENT_DATA_VERSION = 1;

/**
 * 遷移舊專案資料至當前版本。只在 dataVersion < CURRENT_DATA_VERSION 時執行一次。
 * @param {Object} project - 機種資料物件
 * @returns {Object} 升級後之機種資料物件
 */
export function migrateProjectData(project) {
  if (!project) return project;
  const currentVer = typeof project.dataVersion === 'number' ? project.dataVersion : 0;
  if (currentVer >= CURRENT_DATA_VERSION) {
    return project; // 不重複執行遷移
  }

  // 深拷貝防副作用
  const p = JSON.parse(JSON.stringify(project));
  const data = p.data || p;
  const bi = data.basicInfo || {};
  const pc = data.processControl || {};
  const owners = data._owners || {};

  // 1. 成對欄位遷移 (7C.3.3 / D-85)
  // QR code
  if (bi.qrCode) {
    if (!bi.qrCode.need && !bi.qrCode.noNeed) {
      bi.qrCode.need = null;
      bi.qrCode.noNeed = null;
    } else if (bi.qrCode.need && bi.qrCode.noNeed) {
      bi.qrCode.need = null;
      bi.qrCode.noNeed = null;
      p._warnings = p._warnings || [];
      p._warnings.push('QR Code 需求原本皆勾選，已重設為未指定。');
    }
  }
  // 序號管控
  if (bi.snControl) {
    if (!bi.snControl.need && !bi.snControl.noNeed) {
      bi.snControl.need = null;
      bi.snControl.noNeed = null;
    } else if (bi.snControl.need && bi.snControl.noNeed) {
      bi.snControl.need = null;
      bi.snControl.noNeed = null;
      p._warnings = p._warnings || [];
      p._warnings.push('序號管控原本皆勾選，已重設為未指定。');
    }
  }

  // ECN (D-106 / 7C.3.3)
  if (bi.ecnChange) {
    const hasOwner = !!owners['basicInfo.ecnChange'];
    if (bi.ecnChange.has) {
      // 保持肯定
    } else if (bi.ecnChange.no) {
      if (!hasOwner && currentVer === 0) {
        // 程式預設補的，重置為 null
        bi.ecnChange = null;
      }
    } else {
      bi.ecnChange = null;
    }
  } else {
    bi.ecnChange = null;
  }

  // 點膠 (D-85 / 7C.3.3)
  if (bi.glue === undefined || bi.glue === false) {
    bi.glue = null;
  }

  // AOI (7C.3.3)
  if (bi.aoi) {
    if (!bi.aoi.top && !bi.aoi.bottom) {
      bi.aoi = null;
    }
  } else {
    bi.aoi = null;
  }

  // 表面奈米塗層 (D-120 / 7C.3.3)
  if (bi.tooling?.stencil) {
    if (bi.tooling.stencil.nanoCoating === false || bi.tooling.stencil.nanoCoating === undefined) {
      bi.tooling.stencil.nanoCoating = null;
    }
  }

  // 產品階段 (OD-28 / D-77)
  if (bi.stage) {
    const s = bi.stage;
    let evt = !!s.evt;
    let dvt = !!s.dvt;
    let prod = !!(s.pvt || s.mp); // 舊 pvt, mp -> 量產
    let pilot = !!s.politRun;     // 舊 politRun -> MP(小量)
    
    // 多選檢查
    const trueCount = [evt, dvt, prod, pilot].filter(Boolean).length;
    if (trueCount > 1) {
      bi.stage = { evt: false, dvt: false, prod: false, pilot: false };
      p._warnings = p._warnings || [];
      p._warnings.push('舊資料勾選了多個產品階段，已重設，請重新選擇。');
    } else {
      bi.stage = { evt, dvt, prod, pilot };
    }
  }

  // 包材種類 (D-76)
  if (!pc.packagingType) {
    if (pc.pcbaPackaging) {
      pc.pcbaPackaging = { staticBag: false, honeycomb: false, tray: false };
    }
    if (pc.fpcaPackaging) {
      pc.fpcaPackaging = { staticBag: false, honeycomb: false, tray: false };
    }
  }

  // 樣品提供 (7C.3.3)
  if (pc.sampleProvided) {
    const sp = pc.sampleProvided;
    if (!sp.trialBoard && !sp.tempBoard && !sp.standardPart) {
      pc.sampleProvided = null;
    }
  }

  // 治工具與開孔比例 (D-149)
  if (bi.tooling?.stencil?.apertureRatio) {
    if (!pc.smtFirstPiece?.stencilApertureRatio) {
      pc.smtFirstPiece = pc.smtFirstPiece || {};
      pc.smtFirstPiece.stencilApertureRatio = bi.tooling.stencil.apertureRatio;
    }
    delete bi.tooling.stencil.apertureRatio;
  }

  // 工程文件拆分 (OD-58)
  if (bi.documents) {
    if (bi.documents.assemblyPackingSop !== undefined) {
      bi.documents.assemblySop = !!bi.documents.assemblyPackingSop;
      bi.documents.packingSop = !!bi.documents.assemblyPackingSop;
      delete bi.documents.assemblyPackingSop;
    }
  }

  // 料號 trim (D-123)
  if (bi.productNo) {
    bi.productNo = String(bi.productNo).trim();
  }

  // 範本佔位符清除 (D-118)
  if (pc.specialProcessMemo && pc.specialProcessMemo.includes('（如有特殊焊接、清洗、點膠等要求，請於此說明）')) {
    pc.specialProcessMemo = '';
  }
  if (pc.bakeRequired) {
    if (pc.bakeRequired.fpcaBakeTemp === 80 && pc.bakeRequired.fpcaBakeHr === 4 && !owners['processControl.bakeRequired.fpcaBakeTemp']) {
      pc.bakeRequired.fpcaBakeTemp = '';
      pc.bakeRequired.fpcaBakeHr = '';
    }
  }

  // 單位名稱全形括號標準化 (D-31)
  if (data._owners) {
    for (const key of Object.keys(data._owners)) {
      if (typeof data._owners[key] === 'string') {
        data._owners[key] = data._owners[key].replace('審核單位(品保處)', '審核單位（品保處）');
      }
    }
  }

  // 【已知待補 2】已簽核或已核准專案：視為系統升級，保留簽核並記錄「格式升級」
  const hasSignatures = !!(bi.signOff?.rdSignature || bi.signOff?.engineeringReviewSignature || bi.signOff?.qaSignature);
  if (hasSignatures || data.qaApproval) {
    data.signOffHistory = data.signOffHistory || [];
    data.signOffHistory.push({
      action: 'system_upgrade',
      at: new Date().toISOString(),
      reason: `資料結構升級至版本 v${CURRENT_DATA_VERSION}（格式升級：保留既有簽章與核准狀態）`,
      actor: 'system'
    });
  }

  // 標記升級完成
  p.dataVersion = CURRENT_DATA_VERSION;
  if (p.data) p.data.dataVersion = CURRENT_DATA_VERSION;
  return p;
}
