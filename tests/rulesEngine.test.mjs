import assert from 'node:assert/strict';
import { RULES, evaluateAllRules, evaluateStepStatus, getApplicableRules } from '../src/utils/rules/index.js';

console.log('── Rules Engine Unit Tests (BR-3) ──');

// 1. 規則數量與架構檢查
assert.ok(RULES.length >= 20, `規則清單應具備完整防呆規則，目前: ${RULES.length}`);
RULES.forEach((rule) => {
  assert.ok(rule.id, `規則應有 id: ${JSON.stringify(rule)}`);
  assert.ok(rule.stepKey, `規則 ${rule.id} 應有 stepKey`);
  assert.ok(typeof rule.when === 'function', `規則 ${rule.id} when 應為函式`);
  assert.ok(typeof rule.validate === 'function', `規則 ${rule.id} validate 應為函式`);
  assert.ok(['rd', 'eng', 'qa', 'any'].includes(rule.owner), `規則 ${rule.id} owner 不合法: ${rule.owner}`);
  assert.ok(['error', 'warning'].includes(rule.severity), `規則 ${rule.id} severity 不合法: ${rule.severity}`);
});
console.log(`✓ 規則架構完整性校驗通過 (${RULES.length} 條規則)`);

// 2. 簽章不算欄位 (D-21)
const signRules = RULES.filter((r) => r.stepKey === 'signOff' || r.id.includes('Signature'));
assert.equal(signRules.length, 0, '簽章絕對不可列入防呆規則清單 (D-21)');
console.log('✓ 驗證簽章未計入規則欄位 (D-21 零死結保證)');

// 3. 空資料防呆測試 (不通過情況)
const emptyData = {
  basicInfo: {},
  processControl: {},
  trialReport: {},
};
const emptyResult = evaluateAllRules(emptyData);
assert.equal(emptyResult.passedChecks < emptyResult.totalChecks, true, '空資料應有未通過之防呆規則');
assert.ok(emptyResult.warnings.length > 0, '空資料應產生未填寫警告清單');
console.log(`✓ 空資料防呆攔截測試通過 (未通過數: ${emptyResult.warnings.length}/${emptyResult.totalChecks})`);

// 4. 條件不適用測試 (when 判定)
// 當未勾選 SMT 時，SMT 鋼板與 SMT 首件規則不適用
const noSmtData = {
  basicInfo: { processItems: { smt: false, assembly: true } },
  processControl: {},
};
const applicableRulesNoSmt = getApplicableRules(noSmtData);
assert.ok(!applicableRulesNoSmt.some((r) => r.id === 'tooling.stencilStyle'), '未勾選 SMT 時鋼板樣式規則不適用');
assert.ok(!applicableRulesNoSmt.some((r) => r.id === 'smtControl.stencilApertureRatio'), '未勾選 SMT 時開孔比例規則不適用');
console.log('✓ 條件不適用 (when) 規則動態過濾測試通過');

// 5. 完整資料通過測試
const fullData = {
  basicInfo: {
    productNo: 'PN-TEST-001',
    productDesc: '完整測試產品',
    factory: '立訊精密',
    stage: { evt: true },
    ecnChange: { has: false, no: true },
    qualityLevel: 'class2',
    ipcStandard: { ipc610: true },
    processItems: { smt: true, assembly: true },
    tooling: {
      stencil: { style: 'general', thickness: '0.12', nanoCoating: false },
      routingFixture: { need: false, noNeed: true },
      glueFixture: { need: false, noNeed: true },
      testFixture: { need: false, noNeed: true },
      assemblyFixture: { need: true, qty: '2' },
      smtCarrier: { need: false, noNeed: true },
      otherFixture: { need: false, noNeed: true },
    },
    documents: {
      bom: true, gerber: true, coordinate: true, placement: true,
      materialSpec: true, reflowProfile: true, assemblyPackingSop: true, testSop: true,
    },
    glue: { noNeed: true },
    aoi: { noNeed: true },
    qrCode: { noNeed: true },
    snControl: { noNeed: true },
  },
  processControl: {
    sampleProvided: { trialBoard: true },
    bakeRequired: { need: false, noNeed: true },
    packagingType: 'pcba',
    pcbaPackaging: { staticBag: true },
    keyParts: { none: true },
    smtFirstPiece: { polarity: true, ledTest: 'yes', stencilApertureRatio: '100' },
    smtOrder: { bToT: true },
  },
  trialReport: {
    printRecords: [{ id: 1, checked: true }],
    inspectRecords: [{ id: 1, checked: true }],
    yieldReport: { ready: true },
    photoRecords: [{ id: 1, checked: true }],
  },
};

const fullResult = evaluateAllRules(fullData);
assert.equal(fullResult.alignmentRate, 100, `完整資料對齊率應為 100%，目前: ${fullResult.alignmentRate}%`);
assert.equal(fullResult.warnings.length, 0, '完整資料應無任何未通過警告');
console.log('✓ 完整資料對齊率 100% 驗證通過');

// 6. 步驟狀態計算測試 (evaluateStepStatus)
const basicStatus = evaluateStepStatus(fullData, 'basicInfo');
assert.equal(basicStatus.state, 'done', '完整基本資訊步驟狀態應為 done');
assert.equal(basicStatus.applicable, true, '基本資訊應為適用');

const dipStatus = evaluateStepStatus(fullData, 'dipSpecialProcess');
assert.equal(dipStatus.applicable, false, '未勾選 DIP 時 DIP 步驟應不適用');
assert.equal(dipStatus.state, 'done', '不適用步驟狀態應為 done');
console.log('✓ 步驟狀態動態計算 (evaluateStepStatus) 測試通過');

console.log('\n✅ 規則引擎全部單元測試通過 (6/6)！');
