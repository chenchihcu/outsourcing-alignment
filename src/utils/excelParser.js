import * as XLSX from 'xlsx';
import { normalizeApertureRatio } from './normalizeApertureRatio.js';
import { CURRENT_DATA_VERSION } from './dataVersion.js';

// 輔助函數：解析 Checkbox 狀態
function parseCheckbox(val) {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (str.includes('☑') || str.includes('■') || str.includes('✔')) return true;
  if (str.includes('☐')) return false;
  if (str === '1' || str === 1 || str === 'true' || str === true) return true;
  return false;
}

// 輔助函數：清洗數量欄位，去除 Checkbox 符號及方格字元
function cleanQty(val) {
  if (val === null || val === undefined) return '';
  return cleanPlaceholder(String(val).replace(/[☑☐□口]/g, '').trim());
}

// 輔助函數：清洗 Excel 佔位符 (D-118)
function cleanPlaceholder(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/[_]{2,}/.test(str)) return '';
  if (/^厚度\s*_+/i.test(str) || String(str).includes('厚度 ____ mm')) return '';
  if (/^開[口孔]比\s*_+/i.test(str) || String(str).includes('開口比 ____ %')) return '';
  if (str === '數量' || str === '數量:' || str === 'qty' || str === '______') return '';
  if (str === '委外加工廠' || str === '加工廠' || str === '公司名稱') return '';
  if (str === '（如有特殊焊接、清洗、點膠等要求，請於此說明）') return '';
  return str;
}

/**
 * 解析新機種製作需求一覽表 Excel 檔案
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Object} 結構化 JSON 資料
 */
export function parseRequirementExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // 0. 驗證資料版本 dataVersion (7C.3.3 / 已知待補)
  let fileDataVersion = 0;
  if (workbook.Custprops && workbook.Custprops.dataVersion !== undefined) {
    const parsed = parseInt(workbook.Custprops.dataVersion, 10);
    if (!Number.isNaN(parsed)) {
      fileDataVersion = parsed;
    }
  }
  if (fileDataVersion > CURRENT_DATA_VERSION) {
    throw new Error(`此檔案資料版本較新 (v${fileDataVersion})，目前系統版本為 v${CURRENT_DATA_VERSION}，請先更新系統後再匯入。`);
  }

  // D-144 — 驗證必要工作表是否存在
  const requiredSheets = ['產品基本資料', '製程管制與前置作業', '試產報告要求'];
  const missingSheets = requiredSheets.filter(s => !workbook.SheetNames.includes(s));
  if (missingSheets.length > 0) {
    throw new Error(`缺少工作表：${missingSheets.join('、')}`);
  }
  // 驗證標題列
  const titleCell = workbook.Sheets['產品基本資料']?.['A1'];
  const titleStr = String(titleCell?.v || '');
  if (titleCell && !titleStr.includes('新機種') && !titleStr.includes('新產品導入')) {
    throw new Error('此檔案不符合需求一覽表模板格式（A1 標題不符）');
  }

  const data = {
    dataVersion: fileDataVersion,
    basicInfo: {},
    processControl: {},
    trialReport: {}
  };

  // 1. 解析【產品基本資料】工作表
  const sheet1 = workbook.Sheets['產品基本資料'] || workbook.Sheets[workbook.SheetNames[0]];
  if (sheet1) {
    const getVal = (addr) => sheet1[addr] ? sheet1[addr].v : null;

    // 基本資訊
    data.basicInfo.title = getVal('A1') || '';
    data.basicInfo.date = '';
    data.basicInfo.version = '';
    data.basicInfo.factory = cleanPlaceholder(getVal('B4'));
    data.basicInfo.factoryArea = '';

    // 產品階段 (OD-28, D-77)
    const isEcn = parseCheckbox(getVal('G5'));
    data.basicInfo.stage = {
      evt: parseCheckbox(getVal('B5')),
      dvt: parseCheckbox(getVal('C5')),
      pvt: parseCheckbox(getVal('E5')), // 量產
      politRun: parseCheckbox(getVal('F5')), // MP(小量)
      mp: false,
      ecn: isEcn
    };
    
    // ECN 狀態解析 (7C.3.3 三態)
    const g5Val = String(getVal('G5') || '');
    if (g5Val.includes('☑')) {
      data.basicInfo.ecnChange = { has: true, no: false, verificationItem: '' };
    } else if (g5Val.includes('（否）') || g5Val.includes('(否)')) {
      data.basicInfo.ecnChange = { has: false, no: true, verificationItem: '' };
    } else {
      data.basicInfo.ecnChange = fileDataVersion >= 1 ? null : { has: false, no: true, verificationItem: '' };
    }

    // 烘烤參數 (D5/D6 若為佔位符則清空)
    data.basicInfo.pcbBake = cleanPlaceholder(getVal('D5')) || '';
    data.basicInfo.fpcaBake = cleanPlaceholder(getVal('D6')) || '';

    // 產品類別
    data.basicInfo.category = { general: false, medical: false };

    // D-123: 料號去除前後空白
    data.basicInfo.productNo = cleanPlaceholder(getVal('B7')) || '';
    data.basicInfo.productDesc = cleanPlaceholder(getVal('B8')) || '';

    // 品質水準
    data.basicInfo.qualityLevel = {
      class2: parseCheckbox(getVal('B10')),
      class3: parseCheckbox(getVal('C10'))
    };
    data.basicInfo.ipcStandard = {
      ipcA610: parseCheckbox(getVal('E10')),
      jStd001: parseCheckbox(getVal('F10'))
    };

    data.basicInfo.pcbaType = { single: false, double: false };
    data.basicInfo.materialType = '';

    // 加工項目 (Checkbox)
    const f15Val = String(getVal('F15') || '');
    const otherProcess = parseCheckbox(getVal('F15'));
    let otherProcessText = '';
    if (otherProcess) {
      const match = f15Val.match(/[☑☐]\s*其他[:：]?\s*(.*)/) || f15Val.match(/其他[:：]?\s*(.*)/);
      if (match) {
        otherProcessText = match[1].replace(/_+/g, '').trim();
      }
    }

    data.basicInfo.processItems = {
      smt: parseCheckbox(getVal('A14')),
      dip: parseCheckbox(getVal('B14')),
      ict: parseCheckbox(getVal('C14')),
      assembly: parseCheckbox(getVal('D14')),
      coating: parseCheckbox(getVal('E14')),
      packing: parseCheckbox(getVal('F14')),
      fct: parseCheckbox(getVal('A15')),
      flyingProbe: parseCheckbox(getVal('B15')),
      finalTest: parseCheckbox(getVal('C15')),
      underfillGlue: parseCheckbox(getVal('D15')),
      semiFinishedTest: parseCheckbox(getVal('E15')),
      otherProcess: otherProcess,
      otherProcessText: otherProcessText
    };

    // AOI (7C.3.3 三態)
    const a16Val = String(getVal('A16') || '');
    const aoiTop = parseCheckbox(getVal('B16'));
    const aoiBottom = parseCheckbox(getVal('C16'));
    if (aoiTop || aoiBottom) {
      data.basicInfo.aoi = { top: aoiTop, bottom: aoiBottom };
    } else if (a16Val.includes('（不需要）') || a16Val.includes('(不需要)')) {
      data.basicInfo.aoi = { top: false, bottom: false };
    } else {
      data.basicInfo.aoi = fileDataVersion >= 1 ? null : { top: false, bottom: false };
    }

    // 點膠 (7C.3.3 三態)
    const a17Val = String(getVal('A17') || '');
    if (a17Val.includes('☑')) {
      data.basicInfo.glue = true;
    } else if (a17Val.includes('（不需要）') || a17Val.includes('(不需要)')) {
      data.basicInfo.glue = false;
    } else {
      data.basicInfo.glue = fileDataVersion >= 1 ? null : false;
    }

    // QR code (成對三態)
    const qrNeed = parseCheckbox(getVal('E17'));
    const qrNoNeed = parseCheckbox(getVal('F17'));
    if (qrNeed || qrNoNeed) {
      data.basicInfo.qrCode = { need: qrNeed, noNeed: qrNoNeed };
    } else {
      data.basicInfo.qrCode = { need: null, noNeed: null };
    }

    // 序號管控 (成對三態)
    const snNeed = parseCheckbox(getVal('B18'));
    const snNoNeed = parseCheckbox(getVal('C18'));
    if (snNeed || snNoNeed) {
      data.basicInfo.snControl = { need: snNeed, noNeed: snNoNeed };
    } else {
      data.basicInfo.snControl = { need: null, noNeed: null };
    }

    // 特殊/風險零件清單 (Row 22, Row 23, D-104)
    data.basicInfo.riskParts = [];
    const r1Name = cleanPlaceholder(getVal('B22'));
    if (r1Name) {
      data.basicInfo.riskParts.push({
        id: 1,
        name: r1Name,
        packageType: getVal('D22') || '',
        riskDesc: getVal('E22') || ''
      });
    }
    const r2Name = cleanPlaceholder(getVal('B23'));
    if (r2Name) {
      data.basicInfo.riskParts.push({
        id: 2,
        name: r2Name,
        packageType: getVal('D23') || '',
        riskDesc: getVal('E23') || ''
      });
    }

    // 工程文件一覽表 (OD-58 拆分 A29 / G29, 7C.3.3 支援不適用原因)
    const parseDocItem = (addr) => {
      const v = String(getVal(addr) || '');
      const checked = parseCheckbox(v);
      const match = v.match(/[（(]不適用[：:]([^）)]+)[）)]/);
      return { checked, notApplicableReason: match ? match[1].trim() : '' };
    };

    const bomDoc = parseDocItem('A27');
    const gerberDoc = parseDocItem('C27');
    const coordDoc = parseDocItem('E27');
    const placeDoc = parseDocItem('G27');
    const specDoc = parseDocItem('A28');
    const reflowDoc = parseDocItem('G28');
    const assemDoc = parseDocItem('A29');
    const packDoc = parseDocItem('G29');
    const testDoc = parseDocItem('C29');

    data.basicInfo.documents = {
      bom: bomDoc.checked,
      bomReason: bomDoc.notApplicableReason,
      gerber: gerberDoc.checked,
      gerberReason: gerberDoc.notApplicableReason,
      coordinate: coordDoc.checked,
      coordinateReason: coordDoc.notApplicableReason,
      placement: placeDoc.checked,
      placementReason: placeDoc.notApplicableReason,
      materialSpec: specDoc.checked,
      materialSpecReason: specDoc.notApplicableReason,
      reflowProfile: reflowDoc.checked,
      reflowProfileReason: reflowDoc.notApplicableReason,
      assemblySop: assemDoc.checked,
      assemblySopReason: assemDoc.notApplicableReason,
      packingSop: packDoc.checked,
      packingSopReason: packDoc.notApplicableReason,
      testSop: testDoc.checked,
      testSopReason: testDoc.notApplicableReason,
      assemblyPackingSop: assemDoc.checked || packDoc.checked
    };

    // 治工具一覽表
    const d33Val = String(getVal('D33') || '');
    let stencilStyle = 'general';
    if (d33Val.includes('☑ 階梯鋼板')) {
      stencilStyle = 'step';
    } else if (d33Val.includes('☑ 一般鋼板')) {
      stencilStyle = 'general';
    }
    let nanoCoating = null;
    if (d33Val.includes('表面奈米塗層：有') || d33Val.includes('☑ 奈米鋼板')) {
      nanoCoating = true;
    } else if (d33Val.includes('表面奈米塗層：無')) {
      nanoCoating = false;
    } else {
      nanoCoating = fileDataVersion >= 1 ? null : false;
    }

    // 解析 A38 SMT刷錫載具 (D-162)
    const a38Val = String(getVal('A38') || '');
    const isCarrierNeed = a38Val.includes('☑ SMT刷錫載具') || a38Val.includes('☑ 需要') || a38Val.includes('上載板') || a38Val.includes('下載板');
    const isCarrierNoNeed = a38Val.includes('☐ SMT刷錫載具') || a38Val.includes('☑ 不需要');
    const smtCarrier = {
      need: isCarrierNeed && !a38Val.includes('☑ 不需要'),
      noNeed: isCarrierNoNeed && !a38Val.includes('☑ 需要'),
      upper: a38Val.includes('☑ 上載板'),
      lower: a38Val.includes('☑ 下載板')
    };

    // 解析 B38 其他治具 (D-162)
    const b38Val = String(getVal('B38') || '');
    const isOtherNeed = b38Val.includes('☑ 其他治具') || b38Val.includes('☑ 需要');
    const isOtherNoNeed = b38Val.includes('☐ 其他治具') || b38Val.includes('☑ 不需要');
    const otherFixture = {
      need: isOtherNeed && !b38Val.includes('☑ 不需要'),
      noNeed: isOtherNoNeed && !b38Val.includes('☑ 需要'),
      name: '',
      qty: ''
    };
    if (otherFixture.need) {
      const nameMatch = b38Val.match(/名稱[:：]\s*([^\u3000)]+?)(?:\s+數量|$|[)）])/);
      const qtyMatch = b38Val.match(/數量[:：]\s*([^）)]+)/);
      if (nameMatch) {
        otherFixture.name = nameMatch[1].trim();
      }
      if (qtyMatch) {
        otherFixture.qty = qtyMatch[1].trim();
      }
    }

    const rawThickness = cleanPlaceholder(getVal('B33'));
    const parsedThickness = rawThickness.replace(/[^\d.]/g, '');
    const apertureRatio = normalizeApertureRatio(getVal('C33'));

    const parseFixtureItem = (addrNeed, addrNoNeed, addrQty) => {
      const n = parseCheckbox(getVal(addrNeed));
      const no = parseCheckbox(getVal(addrNoNeed));
      if (n || no) {
        return { need: n, noNeed: no, qty: cleanQty(getVal(addrQty)) };
      }
      return { need: null, noNeed: null, qty: cleanQty(getVal(addrQty)) };
    };

    data.basicInfo.tooling = {
      stencil: {
        need: parseCheckbox(getVal('A33')),
        noNeed: !parseCheckbox(getVal('A33')),
        thickness: parsedThickness,
        apertureRatio: apertureRatio,
        style: stencilStyle,
        nanoCoating: nanoCoating
      },
      routingFixture: parseFixtureItem('B34', 'C34', 'D34'),
      glueFixture: parseFixtureItem('B35', 'C35', 'D35'),
      testFixture: parseFixtureItem('B36', 'C36', 'D36'),
      assemblyFixture: parseFixtureItem('B37', 'C37', 'D37'),
      smtCarrier: smtCarrier,
      otherFixture: otherFixture
    };

    // 簽核欄 (D-06, D-115: 匯入一律清除簽章與時間，不得還原簽核狀態)
    data.basicInfo.signOff = {
      rdSignature: '',
      engineeringReviewSignature: '',
      qaSignature: '',
      rdSignedAt: '',
      engineeringReviewSignedAt: '',
      qaSignedAt: ''
    };

    // D-115 舊檔簽章偵測 (標記 _hasLegacySignatures 供 UI 提示需要重新簽核)
    const g1Val = getVal('G1');
    const a41Val = getVal('A41');
    const c41Val = getVal('C41');
    const f41Val = getVal('F41');
    if (g1Val || (a41Val && String(a41Val).includes('已簽')) || (c41Val && String(c41Val).includes('已簽')) || (f41Val && String(f41Val).includes('已簽'))) {
      data._hasLegacySignatures = true;
    }
    // D-115: _owners 亦不從檔案匯入
    data._owners = {};
  }

  // 2. 解析【製程管制與前置作業】工作表
  const sheet2 = workbook.Sheets['製程管制與前置作業'];
  if (sheet2) {
    const getVal = (addr) => sheet2[addr] ? sheet2[addr].v : null;

    // 樣品提供 (7C.3.3)
    const a5Val = String(getVal('A5') || '');
    const tb = parseCheckbox(getVal('B5'));
    const teb = parseCheckbox(getVal('C5'));
    const sp = parseCheckbox(getVal('D5'));
    if (tb || teb || sp) {
      data.processControl.sampleProvided = { trialBoard: tb, tempBoard: teb, standardPart: sp };
    } else if (a5Val.includes('不提供樣品')) {
      data.processControl.sampleProvided = { trialBoard: false, tempBoard: false, standardPart: false, noSample: true };
    } else {
      data.processControl.sampleProvided = fileDataVersion >= 1 ? null : { trialBoard: false, tempBoard: false, standardPart: false };
    }

    // 烘烤
    const bakeNeed = parseCheckbox(getVal('B6'));
    const bakeNoNeed = parseCheckbox(getVal('C6'));
    data.processControl.bakeRequired = {
      need: (bakeNeed || bakeNoNeed) ? bakeNeed : null,
      noNeed: (bakeNeed || bakeNoNeed) ? bakeNoNeed : null,
      pcbBakeCond: cleanPlaceholder(getVal('D6')) || '',
      fpcaBakeCond: cleanPlaceholder(getVal('D7')) || ''
    };

    // 首件檢查
    data.processControl.smtFirstPiece = {
      polarity: parseCheckbox(getVal('B8')),
      measureLcr: String(getVal('D8') || '').includes('☑ 量測 LCR'),
      spi: String(getVal('D8') || '').includes('☑ SPI 錫膏厚度'),
      steelTension: String(getVal('D8') || '').includes('☑ 鋼板張力'),
      ledTest: String(getVal('D8') || '').includes('LED 點亮: 有') ? 'yes' : (String(getVal('D8') || '').includes('LED 點亮: 無') ? 'no' : ''),
      pcbReflow: String(getVal('D8') || '').includes('☑ PCB 外觀'),
      solderability: String(getVal('D8') || '').includes('☑ 濕潤性'),
      stencilApertureRatio: data.basicInfo.tooling?.stencil?.apertureRatio || ''
    };

    data.processControl.dipFirstPiece = {
      cutLead: parseCheckbox(getVal('B9')),
      memo: cleanPlaceholder(String(getVal('D9') || '').replace(/^注意事項[:：]?\s*/, ''))
    };

    // 焊接順序
    data.processControl.smtOrder = {
      bToT: parseCheckbox(getVal('B11')),
      tToB: parseCheckbox(getVal('C11'))
    };

    data.processControl.dipOrder = {
      bToT: parseCheckbox(getVal('E11')),
      tToB: parseCheckbox(getVal('F11'))
    };

    // 關鍵零件
    const kpHas = parseCheckbox(getVal('B12'));
    const kpNone = parseCheckbox(getVal('C12'));
    data.processControl.keyParts = {
      has: (kpHas || kpNone) ? kpHas : null,
      none: (kpHas || kpNone) ? kpNone : null
    };

    // 測溫點配置 (D-110: 包含空白點與逗號字元)
    data.processControl.tempPoints = [];
    const p1Pos = cleanPlaceholder(getVal('B15'));
    const p1Desc = cleanPlaceholder(getVal('C15'));
    const p1Memo = cleanPlaceholder(getVal('D15'));
    data.processControl.tempPoints.push({
      id: 1,
      pos: p1Pos,
      desc: p1Desc,
      memo: p1Memo
    });

    const b16Val = String(getVal('B16') || '');
    if (b16Val) {
      const parts = b16Val.split(/\s*;\s*/);
      parts.forEach((part, idx) => {
        const num = idx + 2;
        if (part.includes('[空白]')) {
          data.processControl.tempPoints.push({ id: num, pos: '', desc: '', memo: '' });
          return;
        }
        const match = part.match(/#\d+\s*\[(.*?)\](?:\s*\((.*?)\))?(?:\s*\{(.*?)\})?/);
        if (match) {
          data.processControl.tempPoints.push({
            id: num,
            pos: match[1] || '',
            desc: match[2] || '',
            memo: match[3] || ''
          });
        } else {
          // 兼容舊格式
          data.processControl.tempPoints.push({
            id: num,
            pos: cleanPlaceholder(part),
            desc: '',
            memo: ''
          });
        }
      });
    }

    // 補齊 6 點
    while (data.processControl.tempPoints.length < 6) {
      data.processControl.tempPoints.push({
        id: data.processControl.tempPoints.length + 1,
        pos: '',
        desc: '',
        memo: ''
      });
    }

    // Underfill (D-111: 非貪婪正規表示式防截斷)
    const b18Val = String(getVal('B18') || '');
    const d18Val = String(getVal('D18') || '');
    const ufMatch = b18Val.match(/(\d+(?:\.\d+)?)\s*°C\D*?(\d+(?:\.\d+)?)\s*min/i);
    data.processControl.underfill = {
      bakeTemp: ufMatch ? ufMatch[1] : '',
      bakeTime: ufMatch ? ufMatch[2] : '',
      glueModel: cleanPlaceholder(d18Val.replace(/^膠材型號[:：]?\s*/, ''))
    };

    // 重工記號
    data.processControl.reworkMark = {
      need: parseCheckbox(getVal('B19')),
      noNeed: parseCheckbox(getVal('C19')),
      sopMark: cleanPlaceholder(getVal('E19'))
    };

    // 特殊製程備註 (D-105: 提取 ECN 驗證項目)
    let a22Val = cleanPlaceholder(getVal('A22'));
    const ecnMatch = a22Val.match(/\[ECN 驗證項目:\s*(.*?)\]/);
    if (ecnMatch) {
      if (data.basicInfo.ecnChange) {
        data.basicInfo.ecnChange.verificationItem = ecnMatch[1].trim();
      }
      a22Val = a22Val.replace(/\[ECN 驗證項目:\s*.*?\]/, '').trim();
    }
    data.processControl.specialProcessMemo = a22Val;

    // 包材種類 (D-117, D-76)
    const pcbaStatic = parseCheckbox(getVal('B25'));
    const pcbaHoneycomb = parseCheckbox(getVal('D25'));
    const pcbaTray = parseCheckbox(getVal('F25'));

    const fpcaStatic = parseCheckbox(getVal('B26'));
    const fpcaHoneycomb = parseCheckbox(getVal('D26'));
    const fpcaTray = parseCheckbox(getVal('F26'));

    let detectedPackagingType = '';
    if (pcbaStatic || pcbaHoneycomb || pcbaTray) {
      detectedPackagingType = 'pcba';
    } else if (fpcaStatic || fpcaHoneycomb || fpcaTray) {
      detectedPackagingType = 'fpca';
    }

    data.processControl.packagingType = detectedPackagingType;
    data.processControl.pcbaPackaging = {
      staticBag: pcbaStatic,
      honeycomb: pcbaHoneycomb,
      tray: pcbaTray
    };
    data.processControl.fpcaPackaging = {
      staticBag: fpcaStatic,
      honeycomb: fpcaHoneycomb,
      tray: fpcaTray
    };
  }

  // 3. 解析【試產報告要求】工作表
  const sheet3 = workbook.Sheets['試產報告要求'];
  if (sheet3) {
    const getVal = (addr) => sheet3[addr] ? sheet3[addr].v : null;

    // 印刷紀錄
    data.trialReport.printRecords = [
      { id: 1, name: "錫膏檢查紀錄表", checked: parseCheckbox(getVal('C6')) },
      { id: 2, name: "迴焊爐溫記錄", checked: parseCheckbox(getVal('C7')) }
    ];

    // 檢驗紀錄 (D-112: 讀回 12, 13, 14, 16, 17)
    data.trialReport.inspectRecords = [
      { id: 1, name: "PCB 板彎/翹曲檢驗紀錄", checked: parseCheckbox(getVal('C12')) },
      { id: 2, name: "首件檢查紀錄表", checked: parseCheckbox(getVal('C13')) },
      { id: 3, name: "鋼板張力量測紀錄", checked: parseCheckbox(getVal('C14')) },
      { id: 4, name: "鋼板清洗紀錄表", checked: parseCheckbox(getVal('C16')) },
      { id: 5, name: "錫膏厚度測試紀錄", checked: parseCheckbox(getVal('C17')) }
    ];

    // 照片紀錄與 X-Ray 零件 (D-119: 僅依逗號切分，絕不因空格切分零件名稱)
    const b25Val = String(getVal('B25') || '');
    let xrayParts = [];
    if (b25Val.includes('指定零件:')) {
      const partsStr = b25Val.replace(/.*指定零件:\s*/, '').trim();
      if (partsStr) {
        if (partsStr.includes('；') || /^\d+:/.test(partsStr)) {
          xrayParts = ['', '', '', ''];
          const items = partsStr.split(/\s*；\s*/);
          items.forEach(item => {
            const m = item.match(/^(\d+):(.*)/);
            if (m) {
              const idx = parseInt(m[1], 10) - 1;
              if (idx >= 0 && idx < 4) {
                xrayParts[idx] = cleanPlaceholder(m[2]);
              }
            }
          });
        } else {
          xrayParts = partsStr.split(/[,，]/).map(cleanPlaceholder);
        }
      }
    }

    data.trialReport.photoRecords = [
      { id: 1, name: "試錫板照片", checked: parseCheckbox(getVal('C24')) },
      {
        id: 2,
        name: "X-Ray 照片",
        checked: parseCheckbox(getVal('C25')),
        isXray: true,
        parts: xrayParts
      }
    ];

    // 良率報告 (D-102: 讀回 A20 狀態)
    const a20Val = String(getVal('A20') || '');
    data.trialReport.yieldReport = {
      ready: a20Val.includes('☑') || a20Val.includes('[已備妥]')
    };
  }

  return data;
}
