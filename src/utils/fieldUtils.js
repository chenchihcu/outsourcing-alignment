export function getFieldHighlightClass(highlightField, fieldName) {
  if (!highlightField) return '';
  if (highlightField === fieldName) return 'highlight-pulse';
  const mapping = {
    factory: ['加工廠'],
    productNo: ['產品料號', '料號'],
    productDesc: ['產品描述', '說明', '描述'],
    stage: ['產品階段', '階段'],
    processItems: ['加工項目'],
    stencil: ['鋼板'],
    routingFixture: ['Routing 治具'],
    glueFixture: ['塗膠治具'],
    testFixture: ['測試治具'],
    assemblyFixture: ['組裝治具'],
    smtCarrier: ['SMT 刷錫載具'],
    otherFixture: ['其他治具'],
    sampleProvided: ['樣品種類'],
    bakeRequired: ['烘烤'],
    smtFirstPiece: ['SMT 首件檢查', 'SMT首件'],
    stencilApertureRatio: ['鋼板開孔比例', '錫膏印刷', '開口比', '開孔比例'],
    ledTest: ['LED點亮測試', 'LED'],
    dipFirstPiece: ['DIP 首件檢查', 'DIP首件', '剪腳前置作業'],
    smtOrder: ['SMT 焊接順序'],
    dipOrder: ['DIP 焊接順序'],
    tempPoints: ['測溫點'],
    pcbaPackaging: ['PCBA 包材種類', 'PCBA包材'],
    fpcaPackaging: ['FPCA 包材種類', 'FPCA包材']
  };
  const keywords = mapping[fieldName];
  if (keywords && keywords.some(k => highlightField.includes(k))) {
    return 'highlight-pulse';
  }
  return '';
}

export function isFieldDisabled(data, currentUser, fieldPath) {
  if (!currentUser) return true;
  if (currentUser.role === 'qa') return true;
  if (currentUser.role === 'admin') return false;
  if (fieldPath === 'basicInfo.factory') return false;
  if (fieldPath === 'basicInfo.stage.evt' || fieldPath === 'basicInfo.stage.dvt') {
    return currentUser.role !== 'rd';
  }
  if (fieldPath === 'basicInfo.stage.pvt' || fieldPath === 'basicInfo.stage.politRun') {
    return currentUser.role !== 'eng';
  }

  const parts = fieldPath.split('.');
  let currentPath = '';
  for (let i = 0; i < parts.length; i++) {
    currentPath = currentPath ? `${currentPath}.${parts[i]}` : parts[i];
    const owner = data._owners?.[currentPath];
    if (owner && owner !== currentUser.unit) {
      const isInternalUnit = (u) => u === '研發單位' || u === '工程單位';
      if (isInternalUnit(owner) && isInternalUnit(currentUser.unit)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

export function setDeep(obj, path, value) {
  const keys = path.split('.');
  const result = { ...obj };
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    const isNextKeyIndex = /^\d+$/.test(nextKey);
    
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = isNextKeyIndex ? [] : {};
    } else {
      if (Array.isArray(current[key])) {
        current[key] = [ ...current[key] ];
      } else {
        current[key] = { ...current[key] };
      }
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

export function getDeep(obj, path) {
  return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

export function shouldSetOwner(value) {
  if (value === '' || value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    return Object.values(value).some(v => v !== false && v !== '' && v !== null && v !== undefined);
  }
  return true;
}

export function updateFieldWithOwner(prev, dataPath, value, unit) {
  const result = setDeep(prev, dataPath, value);
  const owners = { ...(prev._owners || {}) };
  if (shouldSetOwner(value)) {
    owners[dataPath] = unit;
  } else {
    delete owners[dataPath];
  }
  return { ...result, _owners: owners };
}

export function updateWithCustomOwner(prev, updater, ownerChanges) {
  const result = updater(prev);
  const owners = { ...(result._owners || {}) };
  for (const [path, unit] of Object.entries(ownerChanges)) {
    if (unit) {
      owners[path] = unit;
    } else {
      delete owners[path];
    }
  }
  return { ...result, _owners: owners };
}
