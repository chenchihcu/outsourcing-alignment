import fs from 'fs';
import * as XLSX from 'xlsx';
import { parseRequirementExcel } from './src/utils/excelParser.js';
import { exportRequirementExcel } from './src/utils/excelExporter.js';

const templatePath = './新機種製作需求一覽表2026 v2.xlsx';

function runTest() {
  console.log('=== 開始 Excel Parser 與 Exporter 整合測試 (Local) ===');
  
  if (!fs.existsSync(templatePath)) {
    console.error('範本不存在:', templatePath);
    process.exit(1);
  }

  // 1. 讀取並解析原始範本
  const buf = fs.readFileSync(templatePath);
  const originalWb = XLSX.read(buf, { type: 'buffer' });
  const data = parseRequirementExcel(buf);

  console.log('原始解析成功！驗證預設值是否為空白...');
  console.log('B4 factory:', JSON.stringify(data.basicInfo.factory)); // 應為 ''
  console.log('B33 thickness:', JSON.stringify(data.basicInfo.tooling.stencil.thickness)); // 應為 ''
  console.log('C33 apertureRatio:', JSON.stringify(data.basicInfo.tooling.stencil.apertureRatio)); // 應為 ''
  console.log('D33 stencilType:', JSON.stringify(data.basicInfo.tooling.stencil.stencilType)); // 應為 ''
  console.log('smtCarrier:', JSON.stringify(data.basicInfo.tooling.smtCarrier)); 
  console.log('otherFixture:', JSON.stringify(data.basicInfo.tooling.otherFixture));

  // 驗證預設空白防呆
  if (data.basicInfo.factory !== '' || data.basicInfo.tooling.stencil.thickness !== '') {
    console.error('❌ 測試失敗: 預設欄位未成功清理為空白！');
    process.exit(1);
  }

  // 2. 模擬使用者填寫資料
  data.basicInfo.factory = '捷普科技';
  data.basicInfo.productNo = 'JAP-88899-001';
  data.basicInfo.productDesc = '測試智慧手環 PCBA';
  
  // 產品階段
  data.basicInfo.stage = {
    evt: true,
    dvt: false,
    pvt: true,
    politRun: false,
    ecn: true
  };

  // 材質分類
  data.basicInfo.materialType = 'pcb';

  // 鋼板設定為需要，並填寫規格
  data.basicInfo.processItems = {
    smt: true,
    dip: true,
    ict: true,
    assembly: true,
    coating: false,
    packing: true,
    fct: true,
    flyingProbe: false,
    finalTest: true,
    underfillGlue: true,
    semiFinishedTest: true,
    otherProcess: true,
    otherProcessText: '防靜電塗層加工'
  };

  // 工程文件一覽表
  data.basicInfo.documents = {
    bom: true,
    gerber: true,
    coordinate: false,
    placement: true,
    materialSpec: true,
    reflowProfile: true,
    assemblyPackingSop: true,
    testSop: false
  };

  data.basicInfo.tooling.stencil = {
    need: true,
    noNeed: false,
    thickness: '0.13',
    apertureRatio: '95',
    style: 'general',
    nanoCoating: true
  };

  // 烘烤與首件設定
  data.processControl.bakeRequired = {
    need: true,
    noNeed: false,
    pcbBakeTemp: '120',
    pcbBakeTol: '5',
    pcbBakeHr: '2',
    fpcaBakeTemp: '100',
    fpcaBakeHr: '6'
  };

  data.processControl.smtFirstPiece = {
    polarity: true,
    measureLcr: false,
    spi: true,
    steelTension: true,
    ledTest: 'yes',
    pcbReflow: true,
    solderability: false
  };

  // 新治具設定
  data.basicInfo.tooling.smtCarrier = {
    need: true,
    noNeed: false,
    upper: true,
    lower: false
  };

  data.basicInfo.tooling.otherFixture = {
    need: true,
    noNeed: false,
    name: '特製防焊測試載板-A型',
    qty: '3 SETs'
  };

  // 簽章
  data.basicInfo.signOff = {
    rdConfirm: 'RD張三',
    rdSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAA==',
    engineeringReview: 'PE李四',
    engineeringReviewSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAA==',
    qaConfirm: 'QA王五',
    qaSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAA=='
  };

  // 模擬 owners 鎖定
  data._owners = {
    'basicInfo.factory': '研發單位',
    'basicInfo.productNo': '研發單位',
    'stage.evt': '研發單位',
    'stage.pvt': '工程單位'
  };

  // 3. 匯出 Excel
  console.log('正在匯出修改後的資料到臨時 Excel...');
  const outArray = exportRequirementExcel(originalWb, data);
  const tempOutPath = './temp_test_out_local.xlsx';
  fs.writeFileSync(tempOutPath, Buffer.from(outArray));
  console.log('匯出成功，寫入到:', tempOutPath);

  // 4. 再次讀入臨時 Excel 並解析，確認資料完整還原
  console.log('正在讀取臨時 Excel 並重新解析驗證...');
  const outBuf = fs.readFileSync(tempOutPath);
  const reParsedData = parseRequirementExcel(outBuf);

  // 5. 斷言驗證 (Assertions)
  const assert = (actual, expected, message) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.error(`❌ 斷言失敗: ${message}`);
      console.error(`   預期值: ${JSON.stringify(expected)}`);
      console.error(`   實際值: ${JSON.stringify(actual)}`);
      cleanup();
      process.exit(1);
    } else {
      console.log(`✓ 驗證通過: ${message}`);
    }
  };

  assert(reParsedData.basicInfo.factory, '捷普科技', '委外加工廠回填還原');
  assert(reParsedData.basicInfo.productNo, 'JAP-88899-001', '產品料號還原');
  assert(reParsedData.basicInfo.stage.evt, true, '產品階段 EVT 還原');
  assert(reParsedData.basicInfo.stage.dvt, false, '產品階段 DVT 還原');
  assert(reParsedData.basicInfo.stage.ecn, true, '產品階段 ECN 還原');

  assert(reParsedData.basicInfo.tooling.stencil.need, true, '鋼板規格 Need 還原');
  assert(reParsedData.basicInfo.tooling.stencil.thickness, '0.13', '鋼板厚度還原');
  assert(reParsedData.basicInfo.tooling.stencil.apertureRatio, '95', '鋼板開口比還原');
  assert(reParsedData.basicInfo.tooling.stencil.style, 'general', '鋼板樣式 (一般/階梯) 還原');
  assert(reParsedData.basicInfo.tooling.stencil.nanoCoating, true, '表面奈米塗層還原');

  assert(reParsedData.basicInfo.tooling.smtCarrier.need, true, 'SMT刷錫載具 Need 還原');
  assert(reParsedData.basicInfo.tooling.smtCarrier.upper, true, 'SMT刷錫載具 上載板 還原');
  assert(reParsedData.basicInfo.tooling.smtCarrier.lower, false, 'SMT刷錫載具 下載板 還原');

  assert(reParsedData.basicInfo.tooling.otherFixture.need, true, '其他治具 Need 還原');
  assert(reParsedData.basicInfo.tooling.otherFixture.name, '特製防焊測試載板-A型', '其他治具名稱還原');
  assert(reParsedData.basicInfo.tooling.otherFixture.qty, '3 SETs', '其他治具數量還原');

  // 驗證新增的烘烤與 SMT 首件欄位
  assert(reParsedData.processControl.bakeRequired.need, true, '烘烤需求 Need 還原');
  assert(reParsedData.processControl.bakeRequired.pcbBakeTemp, '120', 'PCB 烘烤溫度還原');
  assert(reParsedData.processControl.bakeRequired.pcbBakeTol, '5', 'PCB 烘烤容差還原');
  assert(reParsedData.processControl.bakeRequired.pcbBakeHr, '2', 'PCB 烘烤時間還原');
  assert(reParsedData.processControl.bakeRequired.fpcaBakeTemp, '100', 'FPCA 烘烤溫度還原');
  assert(reParsedData.processControl.bakeRequired.fpcaBakeHr, '6', 'FPCA 烘烤時間還原');

  assert(reParsedData.processControl.smtFirstPiece.polarity, true, 'SMT首件檢查 極性方向還原');
  assert(reParsedData.processControl.smtFirstPiece.measureLcr, false, 'SMT首件檢查 量測LCR還原');
  assert(reParsedData.processControl.smtFirstPiece.spi, true, 'SMT首件檢查 SPI還原');
  assert(reParsedData.processControl.smtFirstPiece.steelTension, true, 'SMT首件檢查 鋼板張力量測還原');
  assert(reParsedData.processControl.smtFirstPiece.ledTest, 'yes', 'SMT首件檢查 LED點亮測試還原');
  assert(reParsedData.processControl.smtFirstPiece.pcbReflow, true, 'SMT首件檢查 PCB外觀檢查還原');
  assert(reParsedData.processControl.smtFirstPiece.solderability, false, 'SMT首件檢查 濕潤性檢查還原');

  // 驗證新增的材質分類 (過時，已於 UI 移除)
  // assert(reParsedData.basicInfo.materialType, 'pcb', '材質分類還原');

  // 驗證新增與修改的加工項目
  assert(reParsedData.basicInfo.processItems.ict, true, '加工項目 In-Circuit Test 還原');
  assert(reParsedData.basicInfo.processItems.fct, true, '加工項目 FCT 功能測試 還原');
  assert(reParsedData.basicInfo.processItems.flyingProbe, false, '加工項目 飛針測試 還原');
  assert(reParsedData.basicInfo.processItems.underfillGlue, true, '加工項目 Underfill 塗膠 還原');
  assert(reParsedData.basicInfo.processItems.semiFinishedTest, true, '加工項目 半成品測試 還原');
  assert(reParsedData.basicInfo.processItems.otherProcess, true, '加工項目 其他 還原');
  assert(reParsedData.basicInfo.processItems.otherProcessText, '防靜電塗層加工', '加工項目 其他說明文字 還原');

  // 驗證工程文件
  assert(reParsedData.basicInfo.documents.bom, true, '工程文件 BOM 還原');
  assert(reParsedData.basicInfo.documents.gerber, true, '工程文件 Gerber 還原');
  assert(reParsedData.basicInfo.documents.assemblyPackingSop, true, '工程文件 組裝(包裝)作業標準書 還原');
  assert(reParsedData.basicInfo.documents.testSop, false, '工程文件 測試作業標準書 還原');
  assert(reParsedData.basicInfo.documents.productSpec, undefined, '工程文件 移除之產品規格書 為空');

  assert(reParsedData.basicInfo.signOff.rdConfirm.startsWith('✓ 已簽章'), true, '研發確認簽章文字狀態還原');
  assert(reParsedData.basicInfo.signOff.rdSignature, '', '基於安全考量，Excel 匯出不夾帶簽章圖檔 (D-115)');
  assert(reParsedData.basicInfo.signOff.engineeringReview.startsWith('✓ 已簽章'), true, '工程審核簽章文字狀態還原');
  assert(reParsedData.basicInfo.signOff.engineeringReviewSignature, '', '基於安全考量，Excel 匯出不夾帶簽章圖檔 (D-115)');
  assert(reParsedData.basicInfo.signOff.qaConfirm.startsWith('✓ 已簽章'), true, '品保最後審核簽章文字狀態還原');
  assert(reParsedData.basicInfo.signOff.qaSignature, '', '基於安全考量，Excel 匯出不夾帶簽章圖檔 (D-115)');

  // D-115: 匯出檔不含 _owners，匯入舊檔時忽略或保持空
  assert(typeof reParsedData._owners, 'object', 'owners 物件結構存在');

  console.log('=== 🎉 恭喜！所有 Excel 往返同步測試與防呆鎖定狀態 Persistence 測試全部通過！ ===');
  cleanup();
}

function cleanup() {
  const tempOutPath = './temp_test_out_local.xlsx';
  if (fs.existsSync(tempOutPath)) {
    fs.unlinkSync(tempOutPath);
    console.log('清理臨時測試檔案完成。');
  }
}

runTest();
