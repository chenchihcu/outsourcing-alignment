import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { exportRequirementExcel } from '../src/utils/excelExporter.js';
import { parseRequirementExcel } from '../src/utils/excelParser.js';
import { migrateProjectData, CURRENT_DATA_VERSION } from '../src/utils/dataVersion.js';

console.log('================================================================');
console.log('  📊  Excel 100% 往返保真度與資料版本校驗 (qa:roundtrip)');
console.log('================================================================\n');

const templatePath = path.resolve('public/新機種製作需求一覽表2026 v2.xlsx');
if (!fs.existsSync(templatePath)) {
  console.error('❌ 找不到範本檔案:', templatePath);
  process.exit(1);
}

const templateBuffer = fs.readFileSync(templatePath);
const templateWb = XLSX.read(templateBuffer, { type: 'buffer' });

// 載入 allowlist
const allowlistPath = path.resolve('tests/roundtrip-allowlist.json');
const allowlist = fs.existsSync(allowlistPath) ? JSON.parse(fs.readFileSync(allowlistPath, 'utf8')) : [];
const allowlistPaths = new Set(allowlist.map(item => item.path));

// 深度比較函數
function diffObjects(objA, objB, currentPath = '') {
  const diffs = [];
  
  if (allowlistPaths.has(currentPath)) {
    return diffs; // 跳過 allowlist 欄位
  }

  if (objA === objB) return diffs;

  if (typeof objA !== typeof objB) {
    diffs.push({ path: currentPath, a: objA, b: objB, reason: '型別不一致' });
    return diffs;
  }

  if (objA === null || objB === null || typeof objA !== 'object') {
    if (objA !== objB) {
      diffs.push({ path: currentPath, a: objA, b: objB, reason: '值不一致' });
    }
    return diffs;
  }

  if (Array.isArray(objA) !== Array.isArray(objB)) {
    diffs.push({ path: currentPath, a: objA, b: objB, reason: '陣列型別不一致' });
    return diffs;
  }

  if (Array.isArray(objA)) {
    const maxLen = Math.max(objA.length, objB.length);
    for (let i = 0; i < maxLen; i++) {
      const p = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
      if (allowlistPaths.has(p)) continue;
      if (i >= objA.length || i >= objB.length) {
        diffs.push({ path: p, a: objA[i], b: objB[i], reason: '陣列長度不一致' });
      } else {
        diffs.push(...diffObjects(objA[i], objB[i], p));
      }
    }
    return diffs;
  }

  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  for (const k of allKeys) {
    if (k.startsWith('_')) continue; // 忽略內部暫存標記
    const p = currentPath ? `${currentPath}.${k}` : k;
    if (allowlistPaths.has(p)) continue;
    diffs.push(...diffObjects(objA[k], objB[k], p));
  }

  return diffs;
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// ── 測試 1: roundtrip-full.json 100% 往返 ──
console.log('── [1] 完整資料往返校驗 (roundtrip-full.json) ──');
const fullFixturePath = path.resolve('tests/fixtures/roundtrip-full.json');
const fullFixture = JSON.parse(fs.readFileSync(fullFixturePath, 'utf8'));

const fullExportBuffer = exportRequirementExcel(templateWb, fullFixture);
assert(fullExportBuffer && fullExportBuffer.byteLength > 0, '匯出成功產生 ArrayBuffer');

const fullExportWb = XLSX.read(fullExportBuffer, { type: 'array' });
assert(fullExportWb.Custprops && fullExportWb.Custprops.dataVersion === CURRENT_DATA_VERSION, `活頁簿包含 dataVersion: ${CURRENT_DATA_VERSION}`);

// 檢查無範本公式覆蓋 (D-114)
const sheet2 = fullExportWb.Sheets['製程管制與前置作業'];
assert(sheet2['B2'] && !sheet2['B2'].f, '製程管制!B2 為值且公式已刪除');
assert(sheet2['D2'] && !sheet2['D2'].f, '製程管制!D2 為值且公式已刪除');

// 檢查無重疊 Merges (D-101)
let mergeOverlap = false;
fullExportWb.SheetNames.forEach(sName => {
  const s = fullExportWb.Sheets[sName];
  const merges = s['!merges'] || [];
  for (let i = 0; i < merges.length; i++) {
    for (let j = i + 1; j < merges.length; j++) {
      const m1 = merges[i];
      const m2 = merges[j];
      if (!(m1.e.r < m2.s.r || m1.s.r > m2.e.r || m1.e.c < m2.s.c || m1.s.c > m2.e.c)) {
        mergeOverlap = true;
      }
    }
  }
});
assert(!mergeOverlap, '匯出檔無任何重疊之合併儲存格');

// 解析並回讀比對
const parsedFull = parseRequirementExcel(fullExportBuffer);
const migratedFull = migrateProjectData(parsedFull);

// 清理比較基準中之料號空白 (D-123: 料號在輸出/解析後已 trim)
const expectedFull = JSON.parse(JSON.stringify(fullFixture));
if (expectedFull.basicInfo?.productNo) {
  expectedFull.basicInfo.productNo = expectedFull.basicInfo.productNo.trim();
}

const fullDiffs = diffObjects(expectedFull, migratedFull);
if (fullDiffs.length > 0) {
  console.error('發現差異欄位:', JSON.stringify(fullDiffs, null, 2));
}
assert(fullDiffs.length === 0, '完整資料往返 0 差異 (100% 欄位吻合)');

// ── 測試 2: roundtrip-empty.json 空白資料往返 ──
console.log('\n── [2] 空白資料往返校驗 (roundtrip-empty.json) ──');
const emptyFixturePath = path.resolve('tests/fixtures/roundtrip-empty.json');
const emptyFixture = JSON.parse(fs.readFileSync(emptyFixturePath, 'utf8'));

const emptyExportBuffer = exportRequirementExcel(templateWb, emptyFixture);
assert(emptyExportBuffer && emptyExportBuffer.byteLength > 0, '空白資料匯出成功產生 ArrayBuffer');

const parsedEmpty = parseRequirementExcel(emptyExportBuffer);
const migratedEmpty = migrateProjectData(parsedEmpty);

const emptyDiffs = diffObjects(emptyFixture, migratedEmpty);
if (emptyDiffs.length > 0) {
  console.error('空白資料發現差異欄位:', JSON.stringify(emptyDiffs, null, 2));
}
assert(emptyDiffs.length === 0, '空白資料往返 0 差異 (無未填被預先勾選)');

// ── 測試 3: 二次往返穩定度 (F15-5) ──
console.log('\n── [3] 二次往返穩定度 (F15-5) ──');
const secondExportBuffer = exportRequirementExcel(templateWb, migratedFull);
const secondParsed = parseRequirementExcel(secondExportBuffer);
const secondDiffs = diffObjects(migratedFull, secondParsed);
assert(secondDiffs.length === 0, '二次往返 0 差異，結構與值完全穩定');

// ── 測試 4: Version 2 檔案拒絕匯入防呆 (F15-15 / 已知待補 4) ──
console.log('\n── [4] Version 2 檔案拒絕匯入防呆 ──');
const v2Wb = XLSX.read(fullExportBuffer, { type: 'array' });
v2Wb.Custprops = v2Wb.Custprops || {};
v2Wb.Custprops['dataVersion'] = 2;
const v2Buffer = XLSX.write(v2Wb, { bookType: 'xlsx', type: 'array' });

let v2Rejected = false;
let v2Message = '';
try {
  parseRequirementExcel(v2Buffer);
} catch (e) {
  v2Rejected = true;
  v2Message = e.message;
}
assert(v2Rejected && v2Message.includes('此檔案資料版本較新 (v2)'), '版本 2 檔案被正確拒絕匯入並提示更新系統');

console.log('\n================================================================');
console.log(`  📋  結果: ${passed} 通過, ${failed} 失敗`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ 所有 Excel 往返與資料版本校驗全數通過！\n');
}
