import { migrateProjectData, CURRENT_DATA_VERSION } from '../src/utils/dataVersion.js';

console.log('── [單元測試] dataVersion 遷移與系統升級邏輯 ──');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

// 1. 舊版未填 ECN 應重設為 null
const oldProjNoOwner = {
  dataVersion: 0,
  basicInfo: {
    ecnChange: { has: false, no: true },
    productNo: ' PN-001 '
  },
  _owners: {}
};
const m1 = migrateProjectData(oldProjNoOwner);
assert(m1.dataVersion === 1, '升級後 dataVersion === 1');
assert(m1.basicInfo.ecnChange === null, '舊版無擁有者之 ECN(否) 應重設為 null (未回答)');
assert(m1.basicInfo.productNo === 'PN-001', '料號頭尾空白被成功 trim');

// 2. 舊版有擁有者之 ECN(否) 應保留
const oldProjWithOwner = {
  dataVersion: 0,
  basicInfo: {
    ecnChange: { has: false, no: true }
  },
  _owners: { 'basicInfo.ecnChange': '研發單位' }
};
const m2 = migrateProjectData(oldProjWithOwner);
assert(m2.basicInfo.ecnChange && m2.basicInfo.ecnChange.no === true, '有擁有者之 ECN(否) 應保留為明確否定');

// 3. 已升級資料 (dataVersion === 1) 再次呼叫不應重複遷移
const alreadyV1 = {
  dataVersion: 1,
  basicInfo: {
    ecnChange: { has: false, no: true } // 使用者在新版本手動選的「否」
  },
  _owners: {}
};
const m3 = migrateProjectData(alreadyV1);
assert(m3.basicInfo.ecnChange && m3.basicInfo.ecnChange.no === true, 'v1 版本之否定答案不應被清空');

// 4. 已簽核之舊專案：保留簽章，記錄系統升級歷史
const signedOldProj = {
  dataVersion: 0,
  basicInfo: {
    signOff: {
      rdSignature: 'data:image/png;base64,AAA',
      rdSignedAt: '2026-07-01T10:00:00Z'
    }
  }
};
const m4 = migrateProjectData(signedOldProj);
assert(m4.basicInfo.signOff.rdSignature === 'data:image/png;base64,AAA', '已簽核專案簽章保留');
assert(m4.signOffHistory && m4.signOffHistory.length === 1, '記錄一筆格式升級歷史');
assert(m4.signOffHistory[0].action === 'system_upgrade', '歷史動作標記為 system_upgrade');

// 5. 舊版多選產品階段應清空並提示警告
const multiStageProj = {
  dataVersion: 0,
  basicInfo: {
    stage: { evt: true, dvt: false, pvt: false, mp: true } // evt + mp 兩項 true
  }
};
const m5 = migrateProjectData(multiStageProj);
assert(!m5.basicInfo.stage.evt && !m5.basicInfo.stage.prod, '多選階段已被清空');
assert(m5._warnings && m5._warnings.length > 0, '產生多選警告提示');

// 6. OD-58 文件欄位拆分
const docProj = {
  dataVersion: 0,
  basicInfo: {
    documents: {
      assemblyPackingSop: true
    }
  }
};
const m6 = migrateProjectData(docProj);
assert(m6.basicInfo.documents.assemblySop === true, 'assemblySop 被遷移為 true');
assert(m6.basicInfo.documents.packingSop === true, 'packingSop 被遷移為 true');
assert(m6.basicInfo.documents.assemblyPackingSop === undefined, '舊 assemblyPackingSop 已被清理');

console.log(`\n結果: ${passed} 通過, ${failed} 失敗`);
if (failed > 0) process.exit(1);
