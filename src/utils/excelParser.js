import * as XLSX from 'xlsx';
import { normalizeApertureRatio } from './normalizeApertureRatio.js';

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

  // D4 — 驗證必要工作表是否存在
  const requiredSheets = ['產品基本資料', '製程管制與前置作業', '試產報告要求'];
  const missingSheets = requiredSheets.filter(s => !workbook.SheetNames.includes(s));
  if (missingSheets.length > 0) {
    throw new Error(`此檔案不符合需求一覽表模板格式（缺少工作表：${missingSheets.join('、')}）`);
  }
  // D4 — 驗證標題列
  const titleCell = workbook.Sheets['產品基本資料']?.['A1'];
  const titleStr = String(titleCell?.v || '');
  if (titleCell && !titleStr.includes('新機種') && !titleStr.includes('新產品導入')) {
    throw new Error('此檔案不符合需求一覽表模板格式（A1 標題不符）');
  }

  const data = {
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

    // 產品階段 (Checkbox)
    const isEcn = parseCheckbox(getVal('G5'));
    data.basicInfo.stage = {
      evt: parseCheckbox(getVal('B5')),
      dvt: parseCheckbox(getVal('C5')),
      pvt: parseCheckbox(getVal('E5')), 
      politRun: parseCheckbox(getVal('F5')),
      mp: parseCheckbox(getVal('H5')),
      ecn: isEcn
    };
    data.basicInfo._legacyEcn = isEcn;
    data.basicInfo.ecnChange = isEcn ? { has: true, no: false } : { has: false, no: true };
    
    // 烘烤參數
    data.basicInfo.pcbBake = cleanPlaceholder(getVal('D5')) || '';
    data.basicInfo.fpcaBake = cleanPlaceholder(getVal('D6')) || '';

    // 產品類別
    data.basicInfo.category = { general: false, medical: false };

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

    // AOI
    data.basicInfo.aoi = {
      top: parseCheckbox(getVal('B16')),
      bottom: parseCheckbox(getVal('C16'))
    };

    // 點膠與 QR code
    data.basicInfo.glue = parseCheckbox(getVal('A17'));
    data.basicInfo.qrCode = {
      need: parseCheckbox(getVal('E17')),
      noNeed: parseCheckbox(getVal('F17'))
    };

    // 序號管控
    data.basicInfo.snControl = {
      need: parseCheckbox(getVal('B18')),
      noNeed: parseCheckbox(getVal('C18'))
    };

    // 特殊/風險零件清單 (Row 22, Row 23)
    data.basicInfo.riskParts = [
      {
        id: 1,
        name: getVal('B22') || '',
        packageType: getVal('D22') || '',
        riskDesc: getVal('E22') || ''
      },
      {
        id: 2,
        name: getVal('B23') || '',
        packageType: getVal('D23') || '',
        riskDesc: getVal('E23') || ''
      }
    ];

    // 工程文件一覽表
    data.basicInfo.documents = {
      bom: parseCheckbox(getVal('A27')),
      gerber: parseCheckbox(getVal('C27')),
      coordinate: parseCheckbox(getVal('E27')),
      placement: parseCheckbox(getVal('G27')),
      materialSpec: parseCheckbox(getVal('A28')),
      reflowProfile: parseCheckbox(getVal('G28')),
      assemblyPackingSop: parseCheckbox(getVal('A29')) || parseCheckbox(getVal('G29')),
      testSop: parseCheckbox(getVal('C29'))
    };

    // 治工具一覽表
    const d33Val = String(getVal('D33') || '');
    let stencilStyle = 'general';
    if (d33Val.includes('☑ 階梯鋼板')) {
      stencilStyle = 'step';
    } else if (d33Val.includes('☑ 一般鋼板')) {
      stencilStyle = 'general';
    }
    const nanoCoating = d33Val.includes('☑ 奈米鋼板');

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

    data.basicInfo.tooling = {
      stencil: {
        need: true,
        noNeed: false,
        thickness: parsedThickness,
        apertureRatio: apertureRatio,
        style: stencilStyle,
        nanoCoating: nanoCoating
      },
      routingFixture: {
        need: parseCheckbox(getVal('B34')),
        noNeed: parseCheckbox(getVal('C34')),
        qty: cleanQty(getVal('D34'))
      },
      glueFixture: {
        need: parseCheckbox(getVal('B35')),
        noNeed: parseCheckbox(getVal('C35')),
        qty: cleanQty(getVal('D35'))
      },
      testFixture: {
        need: parseCheckbox(getVal('B36')),
        noNeed: parseCheckbox(getVal('C36')),
        qty: cleanQty(getVal('D36'))
      },
      assemblyFixture: {
        need: parseCheckbox(getVal('B37')),
        noNeed: parseCheckbox(getVal('C37')),
        qty: cleanQty(getVal('D37'))
      },
      smtCarrier,
      otherFixture
    };

    // 簽核欄文字狀態 (D-101 / D-115: 簽章圖檔不自 Excel 還原，保持安全)
    data.basicInfo.signOff = {
      rdConfirm: getVal('B40') || '',
      engineeringReview: getVal('D40') || '',
      qaConfirm: getVal('G40') || '',
      rdSignature: '',
      engineeringReviewSignature: '',
      qaSignature: '',
      rdSignedAt: '',
      engineeringReviewSignedAt: '',
      qaSignedAt: ''
    };

    // G1 欄位擁有者解析 (D-115: 忽略簽名圖檔，保留純 _owners 相容)
    const g1Val = getVal('G1');
    if (g1Val) {
      try {
        const parsed = JSON.parse(g1Val);
        if (parsed && typeof parsed === 'object') {
          if ('owners' in parsed) {
            data._owners = parsed.owners || {};
          } else {
            data._owners = parsed;
          }
        } else {
          data._owners = {};
        }
      } catch {
        data._owners = {};
      }
    } else {
      data._owners = {};
      if (data.basicInfo.stage?.evt) data._owners['basicInfo.stage.evt'] = '研發單位';
      if (data.basicInfo.stage?.dvt) data._owners['basicInfo.stage.dvt'] = '研發單位';
      if (data.basicInfo.stage?.pvt) data._owners['basicInfo.stage.pvt'] = '工程單位';
      if (data.basicInfo.stage?.politRun) data._owners['basicInfo.stage.politRun'] = '工程單位';
    }

    // 遷移殘留的 stage.*
    ['evt', 'dvt', 'pvt', 'politRun', 'mp'].forEach(k => {
      if (data._owners?.[`stage.${k}`] !== undefined) {
        data._owners[`basicInfo.stage.${k}`] = data._owners[`stage.${k}`];
        delete data._owners[`stage.${k}`];
      }
    });
  }

  // 2. 解析【製程管制與前置作業】工作表
  const sheet2 = workbook.Sheets['製程管制與前置作業'];
  if (sheet2) {
    const getVal = (addr) => sheet2[addr] ? sheet2[addr].v : null;

    // 前置作業
    data.processControl.sampleProvided = {
      trialBoard: parseCheckbox(getVal('B5')),
      tempBoard: parseCheckbox(getVal('C5')),
      standardPart: parseCheckbox(getVal('D5'))
    };

    const pcbCondVal = getVal('D6') || '';
    const fpcaCondVal = getVal('D7') || '';
    
    // 解析 PCB 烘烤條件
    const pcbNorm = String(pcbCondVal).replace(/℃/g, '°C').replace(/\s+/g, ' ');
    const pcbMatch = pcbNorm.match(/PCB 烘烤:\s*([_\d]+)\s*°C\s*±\s*([_\d]+)\s*°C\s*×\s*([_\d]+)\s*hr/);
    let pcbBakeTemp = '', pcbBakeTol = '', pcbBakeHr = '';
    if (pcbMatch) {
      pcbBakeTemp = pcbMatch[1].replace(/_/g, '').trim();
      pcbBakeTol = pcbMatch[2].replace(/_/g, '').trim();
      pcbBakeHr = pcbMatch[3].replace(/_/g, '').trim();
    } else {
      const numbers = String(pcbCondVal).match(/\d+/g);
      if (numbers && numbers.length >= 3) {
        pcbBakeTemp = numbers[0];
        pcbBakeTol = numbers[1];
        pcbBakeHr = numbers[2];
      }
    }

    // 解析 FPCA 烘烤條件
    const fpcaNorm = String(fpcaCondVal).replace(/℃/g, '°C').replace(/\s+/g, ' ');
    const fpcaMatch = fpcaNorm.match(/FPCA 烘烤:.*?([_\d]+)\s*°C\s*×\s*([_\d]+)\s*hr/);
    let fpcaBakeTemp = '', fpcaBakeHr = '';
    if (fpcaMatch) {
      fpcaBakeTemp = fpcaMatch[1].replace(/_/g, '').trim();
      fpcaBakeHr = fpcaMatch[2].replace(/_/g, '').trim();
    } else {
      const numbers = String(fpcaCondVal).match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        fpcaBakeTemp = numbers[0];
        fpcaBakeHr = numbers[1];
      }
    }

    data.processControl.bakeRequired = {
      need: parseCheckbox(getVal('B6')),
      noNeed: parseCheckbox(getVal('C6')),
      pcbBakeCond: pcbCondVal,
      fpcaBakeCond: fpcaCondVal,
      pcbBakeTemp,
      pcbBakeTol,
      pcbBakeHr,
      fpcaBakeTemp,
      fpcaBakeHr
    };

    // SMT 首件 (D-102: 同時支援 D8 整合文字與舊版各欄位)
    const d8Val = String(getVal('D8') || '');
    const isLcrChecked = d8Val.includes('☑ 量測 LCR') || (!d8Val.includes('量測 LCR') && parseCheckbox(getVal('D8')));
    const isSpiChecked = d8Val.includes('☑ SPI') || (!d8Val.includes('SPI') && parseCheckbox(getVal('C8')));
    const isSteelChecked = d8Val.includes('☑ 鋼板張力') || (!d8Val.includes('鋼板張力') && parseCheckbox(getVal('E8')));
    let ledTestVal = null;
    if (d8Val.includes('LED 點亮: 有')) ledTestVal = 'yes';
    else if (d8Val.includes('LED 點亮: 無')) ledTestVal = 'no';
    else if (parseCheckbox(getVal('F8'))) ledTestVal = 'yes';
    else if (parseCheckbox(getVal('G8'))) ledTestVal = 'no';

    const isPcbReflow = d8Val.includes('☑ PCB 外觀') || (!d8Val.includes('PCB 外觀') && parseCheckbox(getVal('H8')));
    const isSolderability = d8Val.includes('☑ 濕潤性') || (!d8Val.includes('濕潤性') && parseCheckbox(getVal('I8')));

    const stencilApertureRatio = normalizeApertureRatio(getVal('J8')) || data.basicInfo.tooling?.stencil?.apertureRatio || '';
    data.processControl.smtFirstPiece = {
      polarity: parseCheckbox(getVal('B8')),
      measureLcr: isLcrChecked,
      spi: isSpiChecked,
      steelTension: isSteelChecked,
      ledTest: ledTestVal,
      pcbReflow: isPcbReflow,
      solderability: isSolderability,
      stencilApertureRatio
    };

    const cleanDipMemo = (val) => {
      if (!val) return '';
      return String(val).replace(/^注意事項[:：]\s*/, '').trim();
    };

    data.processControl.dipFirstPiece = {
      cutLead: parseCheckbox(getVal('B9')),
      memo: cleanDipMemo(getVal('D9'))
    };

    data.processControl.smtOrder = {
      bToT: parseCheckbox(getVal('B11')),
      tToB: parseCheckbox(getVal('C11'))
    };
    data.processControl.dipOrder = {
      bToT: parseCheckbox(getVal('E11')),
      tToB: parseCheckbox(getVal('F11'))
    };

    data.processControl.keyParts = {
      has: parseCheckbox(getVal('B12')),
      none: parseCheckbox(getVal('C12'))
    };

    // 測溫點配置 (D-110: 支援新版固定格式 #2 [loc] (desc) {memo} 及舊版逗號拆分)
    const pts = [];
    pts.push({
      id: 1,
      pos: String(getVal('B15') || '').trim(),
      desc: String(getVal('C15') || '').trim(),
      memo: String(getVal('D15') || '').trim()
    });

    const b16Val = String(getVal('B16') || '');
    if (b16Val.includes('#2') || b16Val.includes('#3')) {
      for (let i = 2; i <= 6; i++) {
        const regex = new RegExp(`#${i}\\s*\\[([^\\]]*)\\]\\s*\\(([^)]*)\\)\\s*\\{([^}]*)\\}`);
        const m = b16Val.match(regex);
        if (m) {
          const loc = m[1].trim() === '空白' ? '' : m[1].trim();
          pts.push({ id: i, pos: loc, desc: m[2].trim(), memo: m[3].trim() });
        } else {
          pts.push({ id: i, pos: '', desc: '', memo: '' });
        }
      }
    } else {
      const rawPos = String(getVal('B16') || '').split(/[,，]+/);
      const rawDesc = String(getVal('C16') || '').split(/[,，\s\n]+/);
      const rawMemo = String(getVal('D16') || '').split(/[,，\s\n]+/);
      for (let i = 0; i < 5; i++) {
        pts.push({
          id: i + 2,
          pos: (rawPos[i] || '').trim(),
          desc: (rawDesc[i] || '').trim(),
          memo: (rawMemo[i] || '').trim()
        });
      }
    }
    data.processControl.tempPoints = pts;

    // Underfill
    const rawBake = getVal('B18') || '';
    let bakeTemp = '';
    let bakeTime = '';
    if (rawBake && !String(rawBake).includes('__')) {
      const match = String(rawBake).match(/(\d+)\s*°C.*(\d+)\s*min/i);
      if (match) {
        bakeTemp = match[1];
        bakeTime = match[2];
      }
    }

    const rawGlue = getVal('D18') || '';
    let glueModel = String(rawGlue).trim();
    if (glueModel.includes('___') || glueModel === '膠材型號:' || glueModel === '膠材型號:___________') {
      glueModel = '';
    }

    data.processControl.underfill = {
      bakeTemp,
      bakeTime,
      glueModel
    };

    data.processControl.reworkMark = {
      need: parseCheckbox(getVal('B19')),
      noNeed: parseCheckbox(getVal('C19')),
      sopMark: getVal('E19') || ''
    };

    // 特殊製程備註 (含 ECN 驗證項目解析，D-105)
    let specialMemo = cleanPlaceholder(getVal('A22')) || '';
    const ecnMatch = specialMemo.match(/\[ECN 驗證項目:\s*([^\]]+)\]/);
    if (ecnMatch) {
      if (data.basicInfo.ecnChange) {
        data.basicInfo.ecnChange.verificationItem = ecnMatch[1].trim();
      }
      specialMemo = specialMemo.replace(/\[ECN 驗證項目:\s*[^\]]+\]/, '').trim();
    }
    data.processControl.specialProcessMemo = specialMemo;

    // 包材方式解析 (D-103, D-76, D-117: 僅 ☑/■/✔ 判定為勾選)
    const isChecked = (v) => {
      if (!v) return false;
      const s = String(v).trim();
      return /[☑■✔]/.test(s);
    };

    const pcbaStatic = isChecked(getVal('B25'));
    const pcbaHoneycomb = isChecked(getVal('D25'));
    const pcbaTray = isChecked(getVal('F25'));

    const fpcaStatic = isChecked(getVal('B26'));
    const fpcaHoneycomb = isChecked(getVal('D26'));
    const fpcaTray = isChecked(getVal('F26'));

    data.processControl.pcbaPackaging = {
      staticBag: pcbaStatic,
      honeycomb: pcbaHoneycomb,
      tray: pcbaTray,
      sensorCover: false,
      cameraCover: false
    };

    data.processControl.fpcaPackaging = {
      staticBag: fpcaStatic,
      honeycomb: fpcaHoneycomb,
      tray: fpcaTray,
      sensorCover: false,
      cameraCover: false
    };

    // D-117: 自動還原 packagingType
    const hasPcba = pcbaStatic || pcbaHoneycomb || pcbaTray;
    const hasFpca = fpcaStatic || fpcaHoneycomb || fpcaTray;
    if (hasPcba && !hasFpca) {
      data.processControl.packagingType = 'pcba';
    } else if (hasFpca && !hasPcba) {
      data.processControl.packagingType = 'fpca';
    } else {
      data.processControl.packagingType = '';
    }
  }

  // 3. 解析【試產報告要求】工作表
  const sheet3 = workbook.Sheets['試產報告要求'];
  if (sheet3) {
    const getVal = (addr) => sheet3[addr] ? sheet3[addr].v : null;

    data.trialReport.passCriteria = {};

    data.trialReport.printRecords = [
      { id: 1, name: getVal('B6') || '', checked: parseCheckbox(getVal('C6')), date: '' },
      { id: 2, name: getVal('B7') || '', checked: parseCheckbox(getVal('C7')), date: '' },
      { id: 3, name: getVal('B8') || '', checked: parseCheckbox(getVal('C8')), date: '' }
    ];

    data.trialReport.inspectRecords = [
      { id: 1, name: 'PCB 板彎/翹曲檢驗紀錄（原材料檢驗：烘烤前/烘烤後）', checked: parseCheckbox(getVal('C12')), date: '' },
      { id: 2, name: getVal('B13') || '', checked: parseCheckbox(getVal('C13')), date: '' },
      { id: 3, name: getVal('B14') || '', checked: parseCheckbox(getVal('C14')), date: '' },
      { id: 4, name: getVal('B16') || '', checked: parseCheckbox(getVal('C16')), date: '' },
      { id: 5, name: getVal('B17') || '', checked: parseCheckbox(getVal('C17')), date: '' }
    ];

    // C. SMT 良率報告 (D-102: 支援 A20 與 C20)
    const a20Val = String(getVal('A20') || '');
    const c20Val = getVal('C20');
    data.trialReport.yieldReport = {
      ready: a20Val.includes('☑') || a20Val.includes('[已備妥]') || parseCheckbox(c20Val)
    };

    // D. 照片提供
    const parseXrayParts = (val) => {
      if (!val) return ['', '', '', ''];
      const str = String(val);
      const match = str.match(/指定零件[:：]\s*(.*)/);
      if (match && match[1]) {
        const parts = match[1].split(/[,，\s]+/).map(p => cleanPlaceholder(p.trim())).filter(Boolean);
        const res = ['', '', '', ''];
        for (let i = 0; i < 4; i++) {
          res[i] = parts[i] || '';
        }
        return res;
      }
      return ['', '', '', ''];
    };

    const photoB25 = getVal('B25') || '';
    data.trialReport.photoRecords = [
      { id: 1, name: getVal('B24') || '', checked: parseCheckbox(getVal('C24')), date: '' },
      { 
        id: 2, 
        name: photoB25, 
        checked: parseCheckbox(getVal('C25')), 
        date: '',
        isXray: true,
        parts: parseXrayParts(photoB25)
      },
      { id: 3, name: getVal('B26') || '', checked: parseCheckbox(getVal('C26')), date: '' },
      { id: 4, name: getVal('B27') || '', checked: parseCheckbox(getVal('C27')), date: '' },
      { id: 5, name: getVal('B28') || '', checked: parseCheckbox(getVal('C28')), date: '' }
    ];
  }

  return data;
}
