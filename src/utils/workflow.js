export const WORKFLOW_STEPS = [
  { key: 'basicInfo', label: '機種基本資訊' },
  { key: 'qualityProcess', label: '品質與加工需求' },
  { key: 'tooling', label: '鋼板與治工具' },
  { key: 'preparation', label: '生產前置作業' },
  { key: 'thermalProfile', label: '測溫點配置' },
  { key: 'smtControl', label: 'SMT 首件管制' },
  { key: 'dipSpecialProcess', label: 'DIP 與特殊製程' },
  { key: 'trialReport', label: '試產交付確認' },
  { key: 'documents', label: '工程文件確認' },
  { key: 'signOff', label: '簽章與匯出' },
];

export const WORKFLOW_STEP_KEYS = WORKFLOW_STEPS.map((step) => step.key);

const hasText = (value) => {
  const text = String(value || '').trim();
  return text.length > 0 && !text.includes('__');
};

const hasTruthyValue = (value) => {
  if (Array.isArray(value)) return value.some(hasTruthyValue);
  if (value && typeof value === 'object') return Object.values(value).some(hasTruthyValue);
  return value === true || hasText(value);
};

const makeStatus = (started, complete, applicable = true) => {
  if (!applicable) return { state: 'done', applicable: false };
  if (complete) return { state: 'done', applicable: true };
  return { state: started ? 'inProgress' : 'pending', applicable: true };
};

const hasSelection = (value, yesKey = 'need', noKey = 'noNeed') =>
  !!(value?.[yesKey] || value?.[noKey]);

const fixtureComplete = (fixture) =>
  !!fixture?.noNeed || (!!fixture?.need && hasText(fixture?.qty));

const allChecked = (records) =>
  Array.isArray(records) && records.length > 0 && records.every((record) => !!record?.checked);

export function getNextWorkflowStep(currentKey) {
  const index = WORKFLOW_STEP_KEYS.indexOf(currentKey);
  return index >= 0 ? WORKFLOW_STEP_KEYS[index + 1] || null : null;
}

export function getWorkflowStatuses(data) {
  const bi = data?.basicInfo || {};
  const pc = data?.processControl || {};
  const tr = data?.trialReport || {};
  const processItems = bi.processItems || {};
  const tooling = bi.tooling || {};
  const signOff = bi.signOff || {};

  const stageSelected = Object.values(bi.stage || {}).some(Boolean);
  const ecnSelected = !!(bi.ecnChange?.has || bi.ecnChange?.no);
  const basicStarted = hasTruthyValue({
    factory: bi.factory,
    productNo: bi.productNo,
    productDesc: bi.productDesc,
    stage: bi.stage,
    ecnChange: bi.ecnChange,
  });
  const basicComplete = !!bi.factory && !!bi.productNo && !!bi.productDesc && stageSelected &&
    ecnSelected && (!bi.ecnChange?.has || hasText(bi.ecnChange?.verificationItem));

  const selectedProcesses = Object.entries(processItems)
    .filter(([key, value]) => key !== 'otherProcessText' && value === true);
  const qualityStarted = hasTruthyValue({
    qualityLevel: bi.qualityLevel,
    ipcStandard: bi.ipcStandard,
    glue: bi.glue,
    qrCode: bi.qrCode,
    snControl: bi.snControl,
    aoi: bi.aoi,
    processItems,
  });
  const qualityComplete = selectedProcesses.length > 0 &&
    (!processItems.otherProcess || hasText(processItems.otherProcessText));

  const toolingStarted = hasTruthyValue(tooling);
  const stencilComplete = !processItems.smt || (
    hasText(tooling.stencil?.thickness) && ['general', 'step'].includes(tooling.stencil?.style)
  );
  const carrierComplete = !!tooling.smtCarrier?.noNeed || (
    !!tooling.smtCarrier?.need && !!(tooling.smtCarrier?.upper || tooling.smtCarrier?.lower)
  );
  const otherFixtureComplete = !!tooling.otherFixture?.noNeed || (
    !!tooling.otherFixture?.need && hasText(tooling.otherFixture?.name) && hasText(tooling.otherFixture?.qty)
  );
  const toolingComplete = stencilComplete &&
    ['routingFixture', 'glueFixture', 'testFixture', 'assemblyFixture']
      .every((key) => fixtureComplete(tooling[key])) &&
    carrierComplete && otherFixtureComplete;

  const sampleComplete = !!(
    pc.sampleProvided?.trialBoard || pc.sampleProvided?.tempBoard || pc.sampleProvided?.standardPart
  );
  const bakeSelected = hasSelection(pc.bakeRequired);
  const bakeDetailsComplete = !pc.bakeRequired?.need || (
    hasText(pc.bakeRequired?.pcbBakeTemp) && hasText(pc.bakeRequired?.pcbBakeTol) &&
    hasText(pc.bakeRequired?.pcbBakeHr) && hasText(pc.bakeRequired?.fpcaBakeTemp) &&
    hasText(pc.bakeRequired?.fpcaBakeHr)
  );
  const packageData = pc.packagingType === 'pcba' ? pc.pcbaPackaging : pc.fpcaPackaging;
  const packagingComplete = !!pc.packagingType && hasTruthyValue(packageData || {});
  const preparationStarted = hasTruthyValue({
    sampleProvided: pc.sampleProvided,
    bakeRequired: pc.bakeRequired,
    packagingType: pc.packagingType,
    pcbaPackaging: pc.pcbaPackaging,
    fpcaPackaging: pc.fpcaPackaging,
  });
  const preparationComplete = sampleComplete && bakeSelected && bakeDetailsComplete && packagingComplete;

  const tempPoints = Array.isArray(pc.tempPoints) ? pc.tempPoints : Object.values(pc.tempPoints || {});
  const keyPartsSelected = !!(pc.keyParts?.has || pc.keyParts?.none);
  const thermalStarted = keyPartsSelected || tempPoints.some((point) => hasText(point?.pos));
  const thermalComplete = keyPartsSelected && (!pc.keyParts?.has || tempPoints.some((point) => hasText(point?.pos)));

  const smtApplicable = !!processItems.smt;
  const smtFirst = pc.smtFirstPiece || {};
  const smtCheckSelected = [
    'polarity', 'measureLcr', 'spi', 'steelTension', 'pcbReflow', 'solderability',
  ].some((key) => !!smtFirst[key]);
  const ledSelected = smtFirst.ledTest === 'yes' || smtFirst.ledTest === 'no';
  const smtOrderSelected = !!(pc.smtOrder?.bToT || pc.smtOrder?.tToB);
  const smtStarted = hasTruthyValue({ smtFirst, smtOrder: pc.smtOrder });
  const smtComplete = smtCheckSelected && ledSelected && hasText(smtFirst.stencilApertureRatio) && smtOrderSelected;

  const dipApplicable = !!processItems.dip;
  const underfillApplicable = !!processItems.underfillGlue;
  const dipSpecialApplicable = dipApplicable || underfillApplicable;
  const dipOrderSelected = !!(pc.dipOrder?.bToT || pc.dipOrder?.tToB);
  const dipComplete = !dipApplicable || (!!pc.dipFirstPiece?.cutLead && dipOrderSelected);
  const underfillComplete = !underfillApplicable || (
    hasText(pc.underfill?.bakeTemp) && hasText(pc.underfill?.bakeTime) && hasText(pc.underfill?.glueModel)
  );
  const dipSpecialStarted = hasTruthyValue({
    dipFirstPiece: pc.dipFirstPiece,
    dipOrder: pc.dipOrder,
    underfill: pc.underfill,
    specialProcessMemo: pc.specialProcessMemo,
  });

  const trialStarted = hasTruthyValue({
    printRecords: tr.printRecords?.map((record) => record?.checked),
    inspectRecords: tr.inspectRecords?.map((record) => record?.checked),
    yieldReport: tr.yieldReport,
    photoRecords: tr.photoRecords?.map((record) => record?.checked),
  });
  const trialComplete = allChecked(tr.printRecords) && allChecked(tr.inspectRecords) &&
    !!tr.yieldReport?.ready && allChecked(tr.photoRecords);

  const documentKeys = [
    'bom', 'gerber', 'coordinate', 'placement', 'materialSpec',
    'reflowProfile', 'assemblyPackingSop', 'testSop',
  ];
  const documentsStarted = documentKeys.some((key) => !!bi.documents?.[key]);
  const documentsComplete = documentKeys.every((key) => !!bi.documents?.[key]);

  const signStarted = hasTruthyValue({
    rdSignature: signOff.rdSignature,
    engineeringReviewSignature: signOff.engineeringReviewSignature,
    qaSignature: signOff.qaSignature,
    rejection: signOff.rejection,
  });
  const signComplete = !!signOff.rdSignature && !!signOff.engineeringReviewSignature &&
    !!signOff.qaSignature && !signOff.rejection;

  return {
    basicInfo: makeStatus(basicStarted, basicComplete),
    qualityProcess: makeStatus(qualityStarted, qualityComplete),
    tooling: makeStatus(toolingStarted, toolingComplete),
    preparation: makeStatus(preparationStarted, preparationComplete),
    thermalProfile: makeStatus(thermalStarted, thermalComplete),
    smtControl: makeStatus(smtStarted, smtComplete, smtApplicable),
    dipSpecialProcess: makeStatus(dipSpecialStarted, dipComplete && underfillComplete, dipSpecialApplicable),
    trialReport: makeStatus(trialStarted, trialComplete),
    documents: makeStatus(documentsStarted, documentsComplete),
    signOff: makeStatus(signStarted, signComplete),
  };
}

/**
 * 檢查前置 9 個步驟是否全部完成（排除簽章步驟本身）(D-21, D-116)
 * @param {Object} data 
 * @returns {boolean}
 */
export function isWorkflowComplete(data) {
  const statuses = getWorkflowStatuses(data);
  const preSignSteps = WORKFLOW_STEP_KEYS.filter((key) => key !== 'signOff');
  return preSignSteps.every((key) => {
    const status = statuses[key];
    return !status?.applicable || status?.state === 'done';
  });
}

