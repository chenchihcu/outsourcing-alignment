import * as XLSX from 'xlsx';
import { normalizeApertureRatio } from './normalizeApertureRatio.js';
import { CURRENT_DATA_VERSION } from './dataVersion.js';

// 輔助函數：更新單個儲存格的值 (D-114: 清除公式快取與公式，避免開檔重算錯誤覆蓋值)
function writeCell(sheet, addr, val) {
  if (!sheet[addr]) {
    sheet[addr] = { t: 's', v: '' };
  }
  sheet[addr].v = val;
  sheet[addr].t = typeof val === 'number' ? 'n' : 's';
  delete sheet[addr].w; // 清除格式化快取
  delete sheet[addr].f; // 清除公式，避免 Excel 重算錯誤的範本公式覆蓋寫入值 (D-114)
  delete sheet[addr].F;
}

// 輔助函數：更新 Checkbox 儲存格 (D-103: 保留原範本標籤，僅切換 ☐/☑ 符號)
function writeCheckbox(sheet, addr, defaultLabel, isChecked) {
  const mark = isChecked ? '☑' : '☐';
  const cell = sheet[addr];
  if (cell && cell.v !== undefined && cell.v !== null) {
    const text = String(cell.v);
    if (/^[☐☑☒✓✔\s]/.test(text)) {
      const stripped = text.replace(/^[☐☑☒✓✔\s]+/, '').trimStart();
      writeCell(sheet, addr, `${mark} ${stripped}`);
      return;
    }
  }
  writeCell(sheet, addr, `${mark} ${defaultLabel}`.trim());
}

function cleanXrayPart(part) {
  const value = String(part || '').trim();
  return /_{2,}/.test(value) ? '' : value;
}

function formatSignatureDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  // 固定使用台北時區輸出 (D-136)
  const dtf = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return dtf.format(date).replace(/\//g, '/');
}

// 檢查 merges 是否重疊 (D-101)
function assertNoOverlappingMerges(sheet) {
  if (!sheet || !sheet['!merges']) return;
  const merges = sheet['!merges'];
  for (let i = 0; i < merges.length; i++) {
    for (let j = i + 1; j < merges.length; j++) {
      const m1 = merges[i];
      const m2 = merges[j];
      const overlaps = !(
        m1.e.r < m2.s.r ||
        m1.s.r > m2.e.r ||
        m1.e.c < m2.s.c ||
        m1.s.c > m2.e.c
      );
      if (overlaps) {
        throw new Error(`發現重疊的合併儲存格: (${XLSX.utils.encode_range(m1)}) 與 (${XLSX.utils.encode_range(m2)})`);
      }
    }
  }
}

// 套用排版格式（欄寬、列高，不向 !merges 重複 push 破壞原結構，D-33）
function applyFormatting(sheet) {
  if (!sheet) return;

  sheet['!cols'] = [
    { wch: 8 },  // A
    { wch: 22 }, // B
    { wch: 18 }, // C
    { wch: 15 }, // D
    { wch: 22 }, // E
    { wch: 15 }, // F
    { wch: 18 }, // G
  ];

  sheet['!rows'] = sheet['!rows'] || [];
  for (let i = 0; i < 45; i++) {
    sheet['!rows'][i] = sheet['!rows'][i] || {};
    if (i === 0) {
      sheet['!rows'][i].hpt = 32;
    } else {
      sheet['!rows'][i].hpt = 22;
    }
  }

  // 設定列印與頁面方向（A4 橫向）
  try {
    sheet['!pageSetup'] = sheet['!pageSetup'] || {};
    sheet['!pageSetup'].orientation = 'landscape';
    sheet['!pageSetup'].paperSize = 9; // A4
    sheet['!pageSetup'].fitToPage = true;
  } catch {
    // ignore
  }

  assertNoOverlappingMerges(sheet);
}

/**
 * 將使用者填寫好的資料回填至原始 Excel 活頁簿中並導出
 * @param {Object} originalWorkbook - 原始讀入的 SheetJS workbook 物件
 * @param {Object} data - 更新後的 JSON 資料
 * @returns {ArrayBuffer} 導出的 Excel ArrayBuffer
 */
export function exportRequirementExcel(originalWorkbook, data) {
  // 複製一份 workbook 以免修改到原始的
  const tempBuffer = XLSX.write(originalWorkbook, { bookType: 'xlsx', type: 'array' });
  const wb = XLSX.read(tempBuffer, { type: 'array' });

  // 1. 活頁簿自訂屬性寫入 dataVersion (7C.3.3)
  wb.Custprops = wb.Custprops || {};
  wb.Custprops['dataVersion'] = CURRENT_DATA_VERSION;

  // 移除範本殘留的隱藏工作表「工作表1」 (D-79 / OD-29)
  if (wb.SheetNames.includes('工作表1')) {
    wb.SheetNames = wb.SheetNames.filter(name => name !== '工作表1');
    delete wb.Sheets['工作表1'];
  }

  // 1. 更新【產品基本資料】
  const sheet1 = wb.Sheets['產品基本資料'] || wb.Sheets[wb.SheetNames[0]];
  if (sheet1) {
    const bi = data.basicInfo || {};
    
    // 基本欄位
    writeCell(sheet1, 'B4', bi.factory || '');

    // 產品階段 Checkbox (D-77, OD-28, 7C.3.3: 嚴格對齊範本 B5, C5, E5, F5，不寫 H5)
    const stage = bi.stage || {};
    writeCheckbox(sheet1, 'B5', 'EVT', !!stage.evt);
    writeCheckbox(sheet1, 'C5', 'DVT', !!stage.dvt);
    writeCheckbox(sheet1, 'E5', '量產', !!(stage.prod ?? stage.pvt)); 
    writeCheckbox(sheet1, 'F5', 'MP(小量)', !!(stage.pilot ?? stage.politRun));

    // ECN 狀態 (7C.3.3: 是 -> ☑; 否 -> ☐ ...（否）; null -> ☐ ...)
    const ecn = bi.ecnChange;
    if (ecn && ecn.has) {
      writeCell(sheet1, 'G5', '☑ ECN改版');
    } else if (ecn && ecn.no) {
      writeCell(sheet1, 'G5', '☐ ECN改版（否）');
    } else {
      writeCell(sheet1, 'G5', '☐ ECN改版');
    }
    // 確保範圍外之 H5 不存在 (D-77)
    delete sheet1['H5'];

    // OD-33: 產品基本資料!D5 與 D6 依規定清空 (烘烤條件由製程管制頁承載)
    writeCell(sheet1, 'D5', '');
    writeCell(sheet1, 'D6', '');

    // D-123: 料號自動去除頭尾空白
    writeCell(sheet1, 'B7', (bi.productNo || '').trim());
    writeCell(sheet1, 'B8', bi.productDesc || '');

    // 品質水準 (OD-30)
    const ql = bi.qualityLevel || {};
    writeCheckbox(sheet1, 'B10', 'Class 2', !!ql.class2);
    writeCheckbox(sheet1, 'C10', 'Class 3', !!ql.class3);
    const ipc = bi.ipcStandard || {};
    writeCheckbox(sheet1, 'E10', 'IPC-A-610', !!ipc.ipcA610);
    writeCheckbox(sheet1, 'F10', 'J-STD-001', !!ipc.jStd001);

    // 加工項目
    const pi = bi.processItems || {};
    writeCheckbox(sheet1, 'A14', 'SMT', !!pi.smt);
    writeCheckbox(sheet1, 'B14', 'DIP', !!pi.dip);
    writeCheckbox(sheet1, 'C14', 'In-Circuit Test', !!pi.ict);
    writeCheckbox(sheet1, 'D14', '組裝', !!pi.assembly);
    writeCheckbox(sheet1, 'E14', '三防膠塗覆', !!pi.coating);
    writeCheckbox(sheet1, 'F14', '包裝', !!pi.packing);
    writeCheckbox(sheet1, 'A15', 'FCT 功能測試', !!pi.fct);
    writeCheckbox(sheet1, 'B15', '飛針測試', !!pi.flyingProbe);
    writeCheckbox(sheet1, 'C15', '成品測試', !!pi.finalTest);
    writeCheckbox(sheet1, 'D15', 'Underfill 塗膠', !!pi.underfillGlue);
    writeCheckbox(sheet1, 'E15', '半成品測試', !!pi.semiFinishedTest);
    
    if (pi.otherProcess) {
      writeCell(sheet1, 'F15', `☑ 其他: ${pi.otherProcessText || ''}`);
    } else {
      writeCell(sheet1, 'F15', `☐ 其他: ________________`);
    }

    // AOI (7C.3.3: 需要/不需要/未回答)
    const aoi = bi.aoi;
    if (aoi && (aoi.top || aoi.bottom)) {
      writeCell(sheet1, 'A16', '👁️  自動光學檢查(AOI)');
      writeCheckbox(sheet1, 'B16', 'Top', !!aoi.top);
      writeCheckbox(sheet1, 'C16', 'Bottom', !!aoi.bottom);
    } else if (aoi === false || (aoi && aoi.need === false)) {
      writeCell(sheet1, 'A16', '👁️  自動光學檢查(AOI)（不需要）');
      writeCheckbox(sheet1, 'B16', 'Top', false);
      writeCheckbox(sheet1, 'C16', 'Bottom', false);
    } else {
      writeCell(sheet1, 'A16', '👁️  自動光學檢查(AOI)');
      writeCheckbox(sheet1, 'B16', 'Top', false);
      writeCheckbox(sheet1, 'C16', 'Bottom', false);
    }

    // 點膠 (7C.3.3: 需要/不需要/未回答)
    if (bi.glue === true) {
      writeCell(sheet1, 'A17', '☑ 點膠');
    } else if (bi.glue === false) {
      writeCell(sheet1, 'A17', '☐ 點膠（不需要）');
    } else {
      writeCell(sheet1, 'A17', '☐ 點膠');
    }

    // QR code (成對三態)
    const qr = bi.qrCode || {};
    writeCheckbox(sheet1, 'E17', '需要', !!qr.need);
    writeCheckbox(sheet1, 'F17', '不需要', !!qr.noNeed);

    // 序號管控 (成對三態)
    const sn = bi.snControl || {};
    writeCheckbox(sheet1, 'B18', '需要', !!sn.need);
    writeCheckbox(sheet1, 'C18', '不需要', !!sn.noNeed);

    // 特殊零件 (D-104: Row 22, Row 23)
    if (bi.riskParts && bi.riskParts.length > 0) {
      if (bi.riskParts[0]) {
        writeCell(sheet1, 'B22', bi.riskParts[0].name || '');
        writeCell(sheet1, 'D22', bi.riskParts[0].packageType || '');
        writeCell(sheet1, 'E22', bi.riskParts[0].riskDesc || '');
      }
      if (bi.riskParts[1]) {
        writeCell(sheet1, 'B23', bi.riskParts[1].name || '');
        writeCell(sheet1, 'D23', bi.riskParts[1].packageType || '');
        writeCell(sheet1, 'E23', bi.riskParts[1].riskDesc || '');
      }
    } else {
      writeCell(sheet1, 'B22', '');
      writeCell(sheet1, 'D22', '');
      writeCell(sheet1, 'E22', '');
      writeCell(sheet1, 'B23', '');
      writeCell(sheet1, 'D23', '');
      writeCell(sheet1, 'E23', '');
    }

    // 工程文件 (D-103 第 5 點, OD-58 A, 7C.3.3)
    const docs = bi.documents || {};
    const writeDocCell = (addr, label, isProvided, notAppReason) => {
      if (isProvided) {
        writeCell(sheet1, addr, `☑ ${label}`);
      } else if (notAppReason) {
        writeCell(sheet1, addr, `☐ ${label}（不適用：${notAppReason}）`);
      } else {
        writeCell(sheet1, addr, `☐ ${label}`);
      }
    };
    writeDocCell('A27', '材料清單 BOM', docs.bom, docs.bomReason);
    writeDocCell('C27', 'Gerber file / CAD', docs.gerber, docs.gerberReason);
    writeDocCell('E27', '座標檔', docs.coordinate, docs.coordinateReason);
    writeDocCell('G27', '零件位置圖', docs.placement, docs.placementReason);
    writeDocCell('A28', '原物料規格書', docs.materialSpec, docs.materialSpecReason);
    writeCell(sheet1, 'C28', '☐ 機構圖（本系統未收集）');
    writeCell(sheet1, 'E28', '☐ 產品規格書（本系統未收集）');
    writeDocCell('G28', 'Reflow 建議曲線圖', docs.reflowProfile, docs.reflowProfileReason);
    writeDocCell('A29', '組裝作業標準書', docs.assemblySop ?? docs.assemblyPackingSop, docs.assemblySopReason);
    writeDocCell('C29', '測試作業標準書', docs.testSop, docs.testSopReason);
    writeCell(sheet1, 'E29', '☐ SMT工藝規範（本系統未收集）');
    writeDocCell('G29', '包裝作業標準書', docs.packingSop ?? docs.assemblyPackingSop, docs.packingSopReason);

    // 治工具
    const tool = bi.tooling || {};
    const smtFirst = data.processControl?.smtFirstPiece || {};
    const stencilApertureRatio = normalizeApertureRatio(smtFirst.stencilApertureRatio || tool.stencil?.apertureRatio || '');
    
    // A33 依 OD-27: 有 SMT 才勾選，無 SMT 則為 ☐
    writeCheckbox(sheet1, 'A33', '鋼板規格', !!pi.smt);
    writeCell(sheet1, 'B33', tool.stencil?.thickness ? `${tool.stencil.thickness} mm` : '厚度 ____ mm');
    // D-102, OD-32, D-142: 單一位置寫開孔比例於 C33
    writeCell(sheet1, 'C33', stencilApertureRatio ? `${stencilApertureRatio}%` : '開口比 ____ %');
    
    // 鋼板樣式與表面奈米塗層 (D-120, R19-4, 7C.3.3)
    const isGeneral = (tool.stencil?.style || 'general') === 'general';
    const isStep = tool.stencil?.style === 'step';
    const markGeneral = isGeneral ? '☑' : '☐';
    const markStep = isStep ? '☑' : '☐';
    let nanoStr = '';
    if (tool.stencil?.nanoCoating === true) {
      nanoStr = '  表面奈米塗層：有';
    } else if (tool.stencil?.nanoCoating === false) {
      nanoStr = '  表面奈米塗層：無';
    }
    writeCell(sheet1, 'D33', `${markGeneral} 一般鋼板  ${markStep} 階梯鋼板${nanoStr}`);

    const checkFixtureWrite = (addrNeed, addrNoNeed, addrQty, fData) => {
      writeCheckbox(sheet1, addrNeed, '需要', !!fData?.need);
      writeCheckbox(sheet1, addrNoNeed, '不需要', !!fData?.noNeed);
      writeCell(sheet1, addrQty, fData?.need ? (fData?.qty || '') : '');
    };
    checkFixtureWrite('B34', 'C34', 'D34', tool.routingFixture);
    checkFixtureWrite('B35', 'C35', 'D35', tool.glueFixture);
    checkFixtureWrite('B36', 'C36', 'D36', tool.testFixture);
    checkFixtureWrite('B37', 'C37', 'D37', tool.assemblyFixture);

    // 回寫 Row 38 - SMT 刷錫載具 與 其他治具 (D-162: 支援三種狀態，標明兩態勾選)
    if (tool.smtCarrier?.need) {
      const markUpper = tool.smtCarrier?.upper ? '☑' : '☐';
      const markLower = tool.smtCarrier?.lower ? '☑' : '☐';
      writeCell(sheet1, 'A38', `SMT刷錫載具：☑ 需要（${markUpper} 上載板  ${markLower} 下載板） ☐ 不需要`);
    } else if (tool.smtCarrier?.noNeed) {
      writeCell(sheet1, 'A38', 'SMT刷錫載具：☐ 需要 ☑ 不需要');
    } else {
      writeCell(sheet1, 'A38', 'SMT刷錫載具：☐ 需要 ☐ 不需要');
    }

    if (tool.otherFixture?.need) {
      const name = tool.otherFixture?.name || '';
      const qty = tool.otherFixture?.qty || '';
      writeCell(sheet1, 'B38', `其他治具：☑ 需要（名稱: ${name}  數量: ${qty}） ☐ 不需要`);
    } else if (tool.otherFixture?.noNeed) {
      writeCell(sheet1, 'B38', '其他治具：☐ 需要 ☑ 不需要');
    } else {
      writeCell(sheet1, 'B38', '其他治具：☐ 需要 ☐ 不需要');
    }

    // 簽核回寫文字狀態 (D-101: 寫入第 41 列可見文字狀態 A41, C41, F41；不寫 B40/D40/G40，不夾帶原圖到 G1)
    const sign = bi.signOff || {};
    writeCell(sheet1, 'A40', '研發確認');
    writeCell(sheet1, 'C40', '工程審核');
    writeCell(sheet1, 'F40', '品保處審核');
    // 清空 B40/D40/G40
    delete sheet1['B40'];
    delete sheet1['D40'];
    delete sheet1['G40'];

    const rdText = sign.rdSignature ? `研發 ${sign.rdSigner || ''} ${formatSignatureDate(sign.rdSignedAt)} 已簽`.trim() : '';
    const peText = sign.engineeringReviewSignature ? `工程 ${sign.engineeringReviewSigner || ''} ${formatSignatureDate(sign.engineeringReviewSignedAt)} 已簽`.trim() : '';
    const qaText = sign.qaSignature ? `品保 ${sign.qaSigner || ''} ${formatSignatureDate(sign.qaSignedAt)} 已簽`.trim() : '';
    writeCell(sheet1, 'A41', rdText);
    writeCell(sheet1, 'C41', peText);
    writeCell(sheet1, 'F41', qaText);

    // D-115: 徹底移除隱藏 G1 的簽章圖檔與 _owners 寫入，確保不洩漏機密簽名
    delete sheet1['G1'];
  }

  // 2. 更新【製程管制與前置作業】
  const sheet2 = wb.Sheets['製程管制與前置作業'];
  if (sheet2) {
    const pc = data.processControl || {};
    const bi = data.basicInfo || {};
    
    // 同步料號 (D-114: 清除公式)
    const pNo = (bi.productNo || '').trim();
    writeCell(sheet2, 'B2', pNo);
    writeCell(sheet2, 'D2', pNo);

    // 樣品提供 (7C.3.3)
    const sample = pc.sampleProvided;
    if (sample && (sample.trialBoard || sample.tempBoard || sample.standardPart)) {
      writeCell(sheet2, 'A5', '🧪  樣品提供');
      writeCheckbox(sheet2, 'B5', '試錫板', !!sample.trialBoard);
      writeCheckbox(sheet2, 'C5', '測溫板', !!sample.tempBoard);
      writeCheckbox(sheet2, 'D5', '標準件', !!sample.standardPart);
    } else if (sample === false || sample?.noSample) {
      writeCell(sheet2, 'A5', '🧪  樣品提供（不提供樣品）');
      writeCheckbox(sheet2, 'B5', '試錫板', false);
      writeCheckbox(sheet2, 'C5', '測溫板', false);
      writeCheckbox(sheet2, 'D5', '標準件', false);
    } else {
      writeCell(sheet2, 'A5', '🧪  樣品提供');
      writeCheckbox(sheet2, 'B5', '試錫板', false);
      writeCheckbox(sheet2, 'C5', '測溫板', false);
      writeCheckbox(sheet2, 'D5', '標準件', false);
    }

    // 烘烤
    const bake = pc.bakeRequired || {};
    writeCheckbox(sheet2, 'B6', '需要', !!bake.need);
    writeCheckbox(sheet2, 'C6', '不需要', !!bake.noNeed);
    
    let pcbBakeCond = '';
    if (bake.need && (bake.pcbBakeTemp || bake.pcbBakeTol || bake.pcbBakeHr)) {
      const tempStr = bake.pcbBakeTemp || '_____';
      const tolStr = bake.pcbBakeTol || '___';
      const hrStr = bake.pcbBakeHr || '___';
      pcbBakeCond = `PCB 烘烤: ${tempStr}  °C ± ${tolStr} °C × ${hrStr} hr（依 PCB 廠建議）`;
    }

    let fpcaBakeCond = '';
    if (bake.need && (bake.fpcaBakeTemp || bake.fpcaBakeHr)) {
      const tempStr = bake.fpcaBakeTemp || '80';
      const hrStr = bake.fpcaBakeHr || '4';
      fpcaBakeCond = `FPCA 烘烤: 依原物料規格書，若無規格則 _${tempStr}__ °C × _${hrStr}__ hr`;
    }
    
    writeCell(sheet2, 'D6', pcbBakeCond);
    writeCell(sheet2, 'D7', fpcaBakeCond);

    // 首件 (D-102: 整合至可見之 B8 與 D8，不寫合併範圍內與範圍外儲存格)
    const smtFirst = pc.smtFirstPiece || {};
    writeCheckbox(sheet2, 'B8', '極性方向', !!smtFirst.polarity);

    const lcrText = smtFirst.measureLcr ? '☑ 量測 LCR' : '☐ 量測 LCR';
    const spiText = smtFirst.spi ? '☑ SPI 錫膏厚度' : '☐ SPI 錫膏厚度';
    const steelText = smtFirst.steelTension ? '☑ 鋼板張力' : '☐ 鋼板張力';
    const ledText = smtFirst.ledTest === 'yes' ? 'LED 點亮: 有' : (smtFirst.ledTest === 'no' ? 'LED 點亮: 無' : 'LED 點亮: 未填');
    const pcbReflowText = smtFirst.pcbReflow ? '☑ PCB 外觀' : '☐ PCB 外觀';
    const solderText = smtFirst.solderability ? '☑ 濕潤性' : '☐ 濕潤性';
    writeCell(sheet2, 'D8', `${lcrText}  ${spiText}  ${steelText}  ${ledText}  ${pcbReflowText}  ${solderText}`);

    // DIP 首件
    const dipFirst = pc.dipFirstPiece || {};
    writeCheckbox(sheet2, 'B9', '剪腳前置作業', !!dipFirst.cutLead);
    writeCell(sheet2, 'D9', dipFirst.memo ? `注意事項: ${dipFirst.memo}` : '');

    // 焊接順序
    const smtOrder = pc.smtOrder || {};
    writeCheckbox(sheet2, 'B11', '先焊底面(B→T)', !!smtOrder.bToT);
    writeCheckbox(sheet2, 'C11', '先焊頂面(T→B)', !!smtOrder.tToB);

    const dipOrder = pc.dipOrder || {};
    writeCheckbox(sheet2, 'E11', '先焊底面(B→T)', !!dipOrder.bToT);
    writeCheckbox(sheet2, 'F11', '先焊頂面(T→B)', !!dipOrder.tToB);

    // 關鍵零件
    const kp = pc.keyParts || {};
    writeCheckbox(sheet2, 'B12', '有', !!kp.has);
    writeCheckbox(sheet2, 'C12', '無', !!kp.none);

    // 測溫點 (D-110: 固定格式寫在第 16 列，不插入列)
    if (pc.tempPoints && pc.tempPoints.length > 0) {
      writeCell(sheet2, 'B15', pc.tempPoints[0].pos || '');
      writeCell(sheet2, 'C15', pc.tempPoints[0].desc || '');
      writeCell(sheet2, 'D15', pc.tempPoints[0].memo || '');

      const otherPointsStr = pc.tempPoints.slice(1).map((p, idx) => {
        const num = idx + 2;
        const loc = (p.pos || '').trim();
        const desc = (p.desc || '').trim();
        const memo = (p.memo || '').trim();
        if (!loc && !desc && !memo) return `#${num} [空白]`;
        return `#${num} [${loc}] (${desc}) {${memo}}`;
      }).join(' ; ');

      writeCell(sheet2, 'B16', otherPointsStr);
    } else {
      writeCell(sheet2, 'B15', '');
      writeCell(sheet2, 'C15', '');
      writeCell(sheet2, 'D15', '');
      writeCell(sheet2, 'B16', '');
    }

    // Underfill (D-111)
    const uf = pc.underfill || {};
    const bakeCond = (uf.bakeTemp && uf.bakeTime) ? `${uf.bakeTemp}°C × ${uf.bakeTime}min` : '';
    writeCell(sheet2, 'B18', bakeCond);
    writeCell(sheet2, 'D18', uf.glueModel ? `膠材型號: ${uf.glueModel}` : '');

    // 重工記號
    const rework = pc.reworkMark || {};
    writeCheckbox(sheet2, 'B19', '需要', !!rework.need);
    writeCheckbox(sheet2, 'C19', '不需要', !!rework.noNeed);
    writeCell(sheet2, 'E19', rework.sopMark || '');

    // 特殊備註 (含 ECN 驗證項目，D-105; 清除佔位符，D-118)
    let specialMemo = pc.specialProcessMemo || '';
    if (specialMemo.includes('（如有特殊焊接、清洗、點膠等要求，請於此說明）')) {
      specialMemo = '';
    }
    if (bi.ecnChange?.has && bi.ecnChange?.verificationItem) {
      const ecnPrefix = `[ECN 驗證項目: ${bi.ecnChange.verificationItem}]`;
      if (!specialMemo.includes(ecnPrefix)) {
        specialMemo = specialMemo ? `${ecnPrefix} ${specialMemo}` : ecnPrefix;
      }
    }
    writeCell(sheet2, 'A22', specialMemo);

    // 包材種類 (D-103, D-76, D-117: 逐格勾選範本原格子)
    const pkgType = pc.packagingType;
    const pcba = pc.pcbaPackaging || {};
    const fpca = pc.fpcaPackaging || {};

    if (pkgType === 'pcba') {
      writeCheckbox(sheet2, 'B25', '靜電袋', !!pcba.staticBag);
      writeCheckbox(sheet2, 'D25', '蜂巢式抗靜電隔板', !!pcba.honeycomb);
      writeCheckbox(sheet2, 'F25', 'Tray 抗靜電脆盤', !!pcba.tray);

      writeCheckbox(sheet2, 'B26', '靜電袋', false);
      writeCheckbox(sheet2, 'D26', '蜂巢式抗靜電隔板', false);
      writeCheckbox(sheet2, 'F26', 'Tray 抗靜電脆盤', false);
    } else if (pkgType === 'fpca') {
      writeCheckbox(sheet2, 'B25', '靜電袋', false);
      writeCheckbox(sheet2, 'D25', '蜂巢式抗靜電隔板', false);
      writeCheckbox(sheet2, 'F25', 'Tray 抗靜電脆盤', false);

      writeCheckbox(sheet2, 'B26', '靜電袋', !!fpca.staticBag);
      writeCheckbox(sheet2, 'D26', '蜂巢式抗靜電隔板', !!fpca.honeycomb);
      writeCheckbox(sheet2, 'F26', 'Tray 抗靜電脆盤', !!fpca.tray);
    } else {
      writeCheckbox(sheet2, 'B25', '靜電袋', false);
      writeCheckbox(sheet2, 'D25', '蜂巢式抗靜電隔板', false);
      writeCheckbox(sheet2, 'F25', 'Tray 抗靜電脆盤', false);

      writeCheckbox(sheet2, 'B26', '靜電袋', false);
      writeCheckbox(sheet2, 'D26', '蜂巢式抗靜電隔板', false);
      writeCheckbox(sheet2, 'F26', 'Tray 抗靜電脆盤', false);
    }

    // 簽核 (稽核人員確認 - 回寫品保確認人)
    const sign = bi.signOff || {};
    writeCell(sheet2, 'E34', sign.qaSignature ? `QA 已簽章 ${formatSignatureDate(sign.qaSignedAt)}`.trim() : '');
  }

  // 3. 更新【試產報告要求】
  const sheet3 = wb.Sheets['試產報告要求'];
  if (sheet3) {
    const tr = data.trialReport || {};
    const bi = data.basicInfo || {};
    writeCell(sheet3, 'B2', (bi.productNo || '').trim());

    // 印刷紀錄
    const updateRecords = (records, startRow) => {
      records.forEach((rec, idx) => {
        const r = startRow + idx;
        writeCheckbox(sheet3, `C${r}`, '', !!rec.checked);
      });
    };

    if (tr.printRecords) {
      if (tr.printRecordsNotApplicable) {
        writeCell(sheet3, 'A4', `A. 錫膏印刷與迴焊紀錄（不適用：${tr.printRecordsReason || ''}）`);
      }
      updateRecords(tr.printRecords, 6);
    }

    // 檢驗紀錄 (D-112: 保持列對應，第 15 列標「不適用(本系統已移除此項)」OD-35)
    if (tr.inspectRecords) {
      if (tr.inspectRecordsNotApplicable) {
        writeCell(sheet3, 'A10', `B. 試產檢驗紀錄（不適用：${tr.inspectRecordsReason || ''}）`);
      }
      // 範本檢驗紀錄列: 12, 13, 14, 16, 17; 第 15 列為鋼板 IQC
      const rows = [12, 13, 14, 16, 17];
      tr.inspectRecords.forEach((rec, idx) => {
        if (idx < rows.length) {
          writeCheckbox(sheet3, `C${rows[idx]}`, '', !!rec.checked);
        }
      });
      // 第 15 列固定標不適用 (OD-35)
      writeCell(sheet3, 'C15', '不適用（本系統已移除此項）');
    }

    // 照片紀錄
    if (tr.photoRecords) {
      if (tr.photoRecordsNotApplicable) {
        writeCell(sheet3, 'A22', `D. 試產照片（不適用：${tr.photoRecordsReason || ''}）`);
      }
      tr.photoRecords.forEach((rec, idx) => {
        const r = 24 + idx;
        writeCheckbox(sheet3, `C${r}`, '', !!rec.checked);
        if (rec.isXray && rec.parts) {
          const partsList = rec.parts.map((p, i) => {
            const cleaned = cleanXrayPart(p);
            return cleaned ? `${i + 1}:${cleaned}` : '';
          }).filter(Boolean);
          const prefix = "X-Ray 照片 / BGA, QFN 檢驗紀錄表 : BGA、QFN、指定零件:";
          const filled = partsList.join('；');
          writeCell(sheet3, `B${r}`, filled ? `${prefix} ${filled}` : prefix);
        }
      });
    }

    // C. SMT 良率報告回寫 (D-102: 寫至可見之 A20，不寫入 A20:C20 合併範圍之內部 C20)
    const yr = tr.yieldReport || {};
    const yrPrefix = yr.ready ? '☑ [已備妥] ' : '☐ [待備妥] ';
    writeCell(sheet3, 'A20', `${yrPrefix}📌 此報告為試產交付之必要文件，須涵蓋良率統計及 DFM 問題分析。`);
  }

  // 套用基礎列高與版面設定
  try {
    const s1 = wb.Sheets['產品基本資料'] || wb.Sheets[wb.SheetNames[0]];
    const s2 = wb.Sheets['製程管制與前置作業'];
    const s3 = wb.Sheets['試產報告要求'];
    applyFormatting(s1);
    applyFormatting(s2);
    applyFormatting(s3);
  } catch (e) {
    console.warn('applyFormatting error', e);
  }

  const wopts = { bookType: 'xlsx', bookSST: false, type: 'array' };
  const out = XLSX.write(wb, wopts);
  return out;
}
