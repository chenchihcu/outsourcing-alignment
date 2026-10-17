/**
 * 規則引擎單一真本 (Single Source of Truth) - (D-21, 7C.3.1 P-1, 7C.3.2)
 * 定義全系統所有步驟、欄位的防呆校驗規則、適用條件 (when)、擁有權角色 (owner) 與嚴重度 (severity)。
 * 
 * 重要規範：
 * 1. 簽章不算欄位 (D-21)，絕不可加入防呆規則清單，防止簽核死結。
 * 2. 完成度與對齊率＝所有當前適用規則中通過之比例。
 * 3. 步驟完成狀態與驗證器完全一致，以本模組為唯一真本。
 */

import { normalizeApertureRatio } from '../normalizeApertureRatio.js';

const hasText = (val) => {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str.length > 0 && !str.includes('____') && !str.includes('___') && !str.includes('__');
};

const PART_REF_REGEX = /^[A-Z]{1,3}\d{1,4}[A-Z]?$/i;

export const RULES = [
  // ── 步驟 1: 機種基本資訊 (basicInfo) ──
  {
    id: 'basicInfo.productNo',
    stepKey: 'basicInfo',
    fieldKey: 'productNo',
    label: '產品料號',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const val = data?.basicInfo?.productNo;
      if (!hasText(val)) return '未填寫「產品料號」';
      const clean = String(val).trim();
      if (!/^[a-zA-Z0-9.\-_]+$/.test(clean)) {
        return '品號只能包含英數字、點(.)、減號(-)與底線(_)';
      }
      return true;
    },
  },
  {
    id: 'basicInfo.productDesc',
    stepKey: 'basicInfo',
    fieldKey: 'productDesc',
    label: '產品名稱 / 描述',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const val = data?.basicInfo?.productDesc;
      if (!hasText(val)) return '未填寫「產品名稱 / 描述」';
      if (String(val).trim().length > 100) return '產品名稱或描述最多 100 字';
      return true;
    },
  },
  {
    id: 'basicInfo.factory',
    stepKey: 'basicInfo',
    fieldKey: 'factory',
    label: '委外加工廠',
    owner: 'any',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const val = data?.basicInfo?.factory;
      return hasText(val) ? true : '未選擇「委外加工廠」名稱';
    },
  },
  {
    id: 'basicInfo.stage',
    stepKey: 'basicInfo',
    fieldKey: 'stage',
    label: '產品階段',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const s = data?.basicInfo?.stage || {};
      const hasStage = Boolean(s.evt || s.dvt || s.pvt || s.politRun || s.mp);
      return hasStage ? true : '未勾選「產品階段」（EVT / DVT / PVT / 試產 Pilot Run / MP）';
    },
  },
  {
    id: 'basicInfo.ecnChange',
    stepKey: 'basicInfo',
    fieldKey: 'ecnChange',
    label: '工程變更 (ECN 改版)',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const ecn = data?.basicInfo?.ecnChange;
      const answered = Boolean(ecn && (ecn.has === true || ecn.no === true || ecn.need === true || ecn.noNeed === true));
      return answered ? true : '請選擇本次是否為 ECN 改版（有 / 無）';
    },
  },
  {
    id: 'basicInfo.ecnVerification',
    stepKey: 'basicInfo',
    fieldKey: 'ecnChange.verificationItem',
    label: 'ECN 驗證項目',
    owner: 'rd',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.ecnChange?.has || data?.basicInfo?.ecnChange?.need),
    validate: (data) => {
      const item = data?.basicInfo?.ecnChange?.verificationItem;
      return hasText(item) ? true : 'ECN 改版需要填寫驗證項目';
    },
  },

  // ── 步驟 2: 品質與加工需求 (qualityProcess) ──
  {
    id: 'qualityProcess.qualityLevel',
    stepKey: 'qualityProcess',
    fieldKey: 'qualityLevel',
    label: '品質水準 (IPC Class)',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const q = data?.basicInfo?.qualityLevel;
      const valid = Boolean(q && (q.class2 || q.class3 || q === 'class2' || q === 'class3'));
      return valid ? true : '請選擇品質水準（IPC Class 2 或 Class 3）';
    },
  },
  {
    id: 'qualityProcess.ipcStandard',
    stepKey: 'qualityProcess',
    fieldKey: 'ipcStandard',
    label: 'IPC 允收規範',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const ipc = data?.basicInfo?.ipcStandard || {};
      const valid = Boolean(ipc.ipc610 || ipc.jstd001 || ipc['ipc-a-610'] || ipc['j-std-001']);
      return valid ? true : '請至少選擇一項 IPC 允收規範（IPC-A-610 / J-STD-001）';
    },
  },
  {
    id: 'qualityProcess.processItems',
    stepKey: 'qualityProcess',
    fieldKey: 'processItems',
    label: '主要加工項目',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const pi = data?.basicInfo?.processItems || {};
      const hasAny = Object.entries(pi).some(([k, v]) => k !== 'otherProcessText' && Boolean(v));
      return hasAny ? true : '請至少選擇一項主要加工項目';
    },
  },
  {
    id: 'qualityProcess.otherProcessText',
    stepKey: 'qualityProcess',
    fieldKey: 'otherProcessText',
    label: '其他加工說明',
    owner: 'rd',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.otherProcess),
    validate: (data) => {
      const val = data?.basicInfo?.processItems?.otherProcessText;
      return hasText(val) ? true : '已勾選「其他加工」，但未填寫說明文字';
    },
  },
  {
    id: 'qualityProcess.glue',
    stepKey: 'qualityProcess',
    fieldKey: 'glue',
    label: '點膠需求',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const g = data?.basicInfo?.glue;
      const answered = Boolean(g && (g.need || g.noNeed || typeof g === 'boolean'));
      return answered ? true : '請選擇是否需要 SMD 點膠固定';
    },
  },
  {
    id: 'qualityProcess.aoi',
    stepKey: 'qualityProcess',
    fieldKey: 'aoi',
    label: 'AOI 檢查',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const a = data?.basicInfo?.aoi;
      if (!a) return '請選擇是否需要 AOI 自動光學檢查';
      if (a.noNeed === true) return true;
      if (a.need === true || a.top || a.bottom) {
        if (!a.top && !a.bottom) return 'AOI 需要時請選擇檢測面（Top 正面 / Bottom 背面）';
        return true;
      }
      return '請選擇是否需要 AOI 自動光學檢查';
    },
  },
  {
    id: 'qualityProcess.qrCode',
    stepKey: 'qualityProcess',
    fieldKey: 'qrCode',
    label: '二維條碼 / QR Code 管控',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const q = data?.basicInfo?.qrCode;
      const answered = Boolean(q && (q.need || q.noNeed));
      return answered ? true : '請選擇是否需要二維條碼 / QR Code 掃描追溯';
    },
  },
  {
    id: 'qualityProcess.snControl',
    stepKey: 'qualityProcess',
    fieldKey: 'snControl',
    label: '單板生產序號管控',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const s = data?.basicInfo?.snControl;
      const answered = Boolean(s && (s.need || s.noNeed));
      return answered ? true : '請選擇是否需要單板生產序號管控';
    },
  },

  // ── 步驟 3: 鋼網與治工具 (tooling) ──
  {
    id: 'tooling.stencilStyle',
    stepKey: 'tooling',
    fieldKey: 'stencil.style',
    label: '鋼網樣式',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const style = data?.basicInfo?.tooling?.stencil?.style;
      const valid = style === 'general' || style === 'step';
      return valid ? true : '有 SMT 加工時請選擇鋼網樣式（一般標準鋼網 / 階梯鋼網）';
    },
  },
  {
    id: 'tooling.stencilThickness',
    stepKey: 'tooling',
    fieldKey: 'stencil.thickness',
    label: '鋼網厚度',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const t = data?.basicInfo?.tooling?.stencil?.thickness;
      if (!hasText(t)) return '未填寫鋼網「厚度」';
      const num = Number(t);
      if (Number.isNaN(num) || num < 0.05 || num > 0.30) {
        return '鋼網厚度要介於 0.05～0.30 mm，例如 0.12';
      }
      return true;
    },
  },
  {
    id: 'tooling.stencilNano',
    stepKey: 'tooling',
    fieldKey: 'stencil.nanoCoating',
    label: '鋼網表面奈米塗層',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const nano = data?.basicInfo?.tooling?.stencil?.nanoCoating;
      const answered = nano !== undefined && nano !== null && (
        nano === true || nano === false || nano?.has || nano?.none
      );
      return answered ? true : '請選擇是否需要表面奈米塗層 (Nano-Coating)';
    },
  },
  {
    id: 'tooling.routingFixture',
    stepKey: 'tooling',
    fieldKey: 'routingFixture',
    label: '分板治具',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.router || data?.basicInfo?.processItems?.smt || data?.basicInfo?.processItems?.dip),
    validate: (data) => {
      const f = data?.basicInfo?.tooling?.routingFixture;
      if (!f || (!f.need && !f.noNeed)) return '未確認「分板治具 (Router Fixture)」是否需要';
      if (f.need && !hasText(f.qty)) return '已確認需要「分板治具 (Router Fixture)」，但未填寫數量';
      return true;
    },
  },
  {
    id: 'tooling.glueFixture',
    stepKey: 'tooling',
    fieldKey: 'glueFixture',
    label: '點膠/塗膠治具',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.glue || data?.basicInfo?.glue?.need),
    validate: (data) => {
      const f = data?.basicInfo?.tooling?.glueFixture;
      if (!f || (!f.need && !f.noNeed)) return '未確認「點膠/塗膠治具」是否需要';
      if (f.need && !hasText(f.qty)) return '已確認需要「點膠/塗膠治具」，但未填寫數量';
      return true;
    },
  },
  {
    id: 'tooling.testFixture',
    stepKey: 'tooling',
    fieldKey: 'testFixture',
    label: '測試治具',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.test || data?.basicInfo?.processItems?.smt || data?.basicInfo?.processItems?.dip),
    validate: (data) => {
      const f = data?.basicInfo?.tooling?.testFixture;
      if (!f || (!f.need && !f.noNeed)) return '未確認「測試治具 (ICT/FCT)」是否需要';
      if (f.need && !hasText(f.qty)) return '已確認需要「測試治具 (ICT/FCT)」，但未填寫數量';
      return true;
    },
  },
  {
    id: 'tooling.assemblyFixture',
    stepKey: 'tooling',
    fieldKey: 'assemblyFixture',
    label: '組裝治具',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.assembly),
    validate: (data) => {
      const f = data?.basicInfo?.tooling?.assemblyFixture;
      if (!f || (!f.need && !f.noNeed)) return '未確認「組裝治具 (Assembly Jig)」是否需要';
      if (f.need && !hasText(f.qty)) return '已確認需要「組裝治具 (Assembly Jig)」，但未填寫數量';
      return true;
    },
  },
  {
    id: 'tooling.smtCarrier',
    stepKey: 'tooling',
    fieldKey: 'smtCarrier',
    label: 'SMT 印刷/過爐載具',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const f = data?.basicInfo?.tooling?.smtCarrier;
      if (!f || (!f.need && !f.noNeed)) return '未確認「SMT 印刷/過爐載具」是否需要';
      if (f.need && !f.upper && !f.lower) return '已勾選需要「SMT 印刷/過爐載具」，但未選擇「Top 面載具 (正面)」或「Bottom 面載具 (背面)」';
      return true;
    },
  },
  {
    id: 'tooling.otherFixture',
    stepKey: 'tooling',
    fieldKey: 'otherFixture',
    label: '其他專案治具',
    owner: 'eng',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const f = data?.basicInfo?.tooling?.otherFixture;
      if (!f || (!f.need && !f.noNeed)) return '未確認「其他專案治具」是否需要';
      if (f.need) {
        if (!hasText(f.name)) return '已勾選需要「其他專案治具」，但未填寫治具名稱';
        if (!hasText(f.qty)) return '已勾選需要「其他專案治具」，但未填寫治具數量';
      }
      return true;
    },
  },

  // ── 步驟 4: 生產前置作業 (preparation) ──
  {
    id: 'preparation.sampleProvided',
    stepKey: 'preparation',
    fieldKey: 'sampleProvided',
    label: '樣品種類提供',
    owner: 'eng',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const s = data?.processControl?.sampleProvided;
      const valid = Boolean(s && (s.trialBoard || s.tempBoard || s.standardPart || s.noSample || s.none));
      return valid ? true : '請選擇提供的樣品種類（試錫空板 / 測溫板 / 黃金樣板），或勾選不提供';
    },
  },
  {
    id: 'preparation.bakeRequired',
    stepKey: 'preparation',
    fieldKey: 'bakeRequired',
    label: 'PCB / FPC 裸板預烘烤確認',
    owner: 'eng',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const b = data?.processControl?.bakeRequired;
      const answered = Boolean(b && (b.need || b.noNeed));
      return answered ? true : '未確認是否需要「PCB / FPC 裸板預烘烤去濕」';
    },
  },
  {
    id: 'preparation.pcbBake',
    stepKey: 'preparation',
    fieldKey: 'bakeRequired.pcb',
    label: 'PCB 裸板烘烤條件',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.processControl?.bakeRequired?.need),
    validate: (data) => {
      const b = data?.processControl?.bakeRequired;
      if (!hasText(b?.pcbBakeTemp) || !hasText(b?.pcbBakeTol) || !hasText(b?.pcbBakeHr)) {
        return '已勾選需要烘烤，但未填妥「PCB 裸板烘烤條件」數值（溫度 / 容差 / 時間）';
      }
      const temp = Number(b.pcbBakeTemp);
      if (Number.isNaN(temp) || temp < 90 || temp > 150) {
        return 'PCB 烘烤溫度要介於 90～150 °C';
      }
      const hr = Number(b.pcbBakeHr);
      if (Number.isNaN(hr) || hr < 0.5 || hr > 24) {
        return 'PCB 烘烤時間要介於 0.5～24 小時';
      }
      return true;
    },
  },
  {
    id: 'preparation.fpcaBake',
    stepKey: 'preparation',
    fieldKey: 'bakeRequired.fpca',
    label: 'FPC 軟板烘烤條件',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.processControl?.bakeRequired?.need),
    validate: (data) => {
      const b = data?.processControl?.bakeRequired;
      if (!hasText(b?.fpcaBakeTemp) || !hasText(b?.fpcaBakeHr)) {
        return '已勾選需要烘烤，但未填妥「FPC 軟板烘烤條件」數值（溫度 / 時間）';
      }
      const temp = Number(b.fpcaBakeTemp);
      if (Number.isNaN(temp) || temp < 50 || temp > 110) {
        return 'FPC 軟板烘烤溫度要介於 50～110 °C';
      }
      const hr = Number(b.fpcaBakeHr);
      if (Number.isNaN(hr) || hr < 0.5 || hr > 24) {
        return 'FPC 軟板烘烤時間要介於 0.5～24 小時';
      }
      return true;
    },
  },
  {
    id: 'preparation.packagingType',
    stepKey: 'preparation',
    fieldKey: 'packagingType',
    label: '包材種類',
    owner: 'eng',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const t = data?.processControl?.packagingType;
      const valid = t === 'pcba' || t === 'fpca';
      return valid ? true : '未選擇「包材種類」（PCBA 出貨包材 / FPCA 軟板出貨包材）';
    },
  },
  {
    id: 'preparation.packagingItems',
    stepKey: 'preparation',
    fieldKey: 'packagingItems',
    label: '包材項目選擇',
    owner: 'eng',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const pc = data?.processControl || {};
      const pkgType = pc.packagingType;
      if (!pkgType) return '未選擇包材項目';
      const pkg = pkgType === 'pcba' ? pc.pcbaPackaging : pc.fpcaPackaging;
      const hasAny = Boolean(pkg && Object.values(pkg).some(Boolean));
      return hasAny ? true : `已選 ${pkgType.toUpperCase()} 包材，但未勾選任何包材項目`;
    },
  },

  // ── 步驟 5: 測溫點配置 (thermalProfile) ──
  {
    id: 'thermalProfile.keyParts',
    stepKey: 'thermalProfile',
    fieldKey: 'keyParts',
    label: '關鍵熱敏感元件確認',
    owner: 'eng',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const kp = data?.processControl?.keyParts;
      const answered = Boolean(kp && (kp.has || kp.none));
      return answered ? true : '請選擇是否有關鍵熱敏感 / 大熱容量元件';
    },
  },
  {
    id: 'thermalProfile.tempPoints',
    stepKey: 'thermalProfile',
    fieldKey: 'tempPoints',
    label: '測溫點位置 (RefDes)',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.processControl?.keyParts?.has),
    validate: (data) => {
      const raw = data?.processControl?.tempPoints || [];
      const points = (Array.isArray(raw) ? raw : Object.values(raw)).filter((p) => hasText(p?.pos));
      if (points.length < 1) {
        return '已勾選有關鍵零件，但尚未填寫任何「測溫點」位置';
      }
      for (const p of points) {
        if (!PART_REF_REGEX.test(String(p.pos).trim())) {
          return `測溫點位號「${p.pos}」格式不正確，例如 U12、BGA1`;
        }
      }
      return true;
    },
  },

  // ── 步驟 6: SMT 首件管制 (smtControl) ──
  {
    id: 'smtControl.firstPieceChecks',
    stepKey: 'smtControl',
    fieldKey: 'smtFirstPiece',
    label: 'SMT 首件檢驗項目',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const smt = data?.processControl?.smtFirstPiece || {};
      const hasChecks = Boolean(
        smt.polarity || smt.measureLcr || smt.spi || smt.steelTension ||
        smt.pcbReflow || smt.solderability
      );
      return hasChecks ? true : '未確認「SMT 首件檢驗管制」項目（極性方向 / LCR量測 / SPI錫膏檢查 / 鋼網張力量測 / 迴焊後外觀 / 潤濕性）';
    },
  },
  {
    id: 'smtControl.ledTest',
    stepKey: 'smtControl',
    fieldKey: 'ledTest',
    label: 'SMT LED點亮測試',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const led = data?.processControl?.smtFirstPiece?.ledTest;
      const valid = led === 'yes' || led === 'no';
      return valid ? true : '未確認 SMT「LED點亮測試」為「有」或「無 (不適用)」';
    },
  },
  {
    id: 'smtControl.stencilApertureRatio',
    stepKey: 'smtControl',
    fieldKey: 'stencilApertureRatio',
    label: '鋼網開孔縮放比',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const ratio = normalizeApertureRatio(data?.processControl?.smtFirstPiece?.stencilApertureRatio || '');
      if (!ratio) return '未填寫「鋼網開孔縮放比（Aperture-to-Pad Ratio）」';
      const num = Number(ratio);
      if (Number.isNaN(num) || num < 50 || num > 120) {
        return '鋼網開孔縮放比需介於 50% 至 120% 之間';
      }
      return true;
    },
  },
  {
    id: 'smtControl.smtOrder',
    stepKey: 'smtControl',
    fieldKey: 'smtOrder',
    label: 'SMT 焊接過爐順序',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.smt),
    validate: (data) => {
      const o = data?.processControl?.smtOrder || {};
      const valid = Boolean(o.bToT || o.tToB);
      return valid ? true : '未確認「SMT 焊接過爐順序」（先焊正面 / 先焊背面）';
    },
  },

  // ── 步驟 7: DIP 與特殊製程 (dipSpecialProcess) ──
  {
    id: 'dipSpecialProcess.cutLead',
    stepKey: 'dipSpecialProcess',
    fieldKey: 'dipFirstPiece.cutLead',
    label: 'DIP 引腳預成型與剪腳作業',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.dip),
    validate: (data) => {
      const cut = data?.processControl?.dipFirstPiece?.cutLead;
      return cut ? true : '未勾選 DIP 首件「引腳預成型與剪腳作業」';
    },
  },
  {
    id: 'dipSpecialProcess.dipOrder',
    stepKey: 'dipSpecialProcess',
    fieldKey: 'dipOrder',
    label: 'DIP 焊接順序',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.dip),
    validate: (data) => {
      const o = data?.processControl?.dipOrder || {};
      const valid = Boolean(o.bToT || o.tToB);
      return valid ? true : '未確認「DIP 焊接順序」';
    },
  },
  {
    id: 'dipSpecialProcess.underfill',
    stepKey: 'dipSpecialProcess',
    fieldKey: 'underfill',
    label: 'Underfill 熱固化條件與膠材型號',
    owner: 'eng',
    severity: 'error',
    when: (data) => Boolean(data?.basicInfo?.processItems?.underfillGlue),
    validate: (data) => {
      const u = data?.processControl?.underfill || {};
      if (!hasText(u.bakeTemp) || !hasText(u.bakeTime) || !hasText(u.glueModel)) {
        return '已勾選 Underfill 底部填膠，但未填妥熱固化溫度、時間或膠材型號';
      }
      return true;
    },
  },

  // ── 步驟 8: 試產交付確認 (trialReport) ──
  {
    id: 'trialReport.printRecords',
    stepKey: 'trialReport',
    fieldKey: 'printRecords',
    label: '印刷紀錄確認',
    owner: 'qa',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const records = data?.trialReport?.printRecords;
      const valid = Array.isArray(records) && records.length > 0 && records.some((r) => r?.checked);
      return valid ? true : '請至少確認一項試產印刷紀錄（或不適用原因）';
    },
  },
  {
    id: 'trialReport.inspectRecords',
    stepKey: 'trialReport',
    fieldKey: 'inspectRecords',
    label: '檢驗紀錄確認',
    owner: 'qa',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const records = data?.trialReport?.inspectRecords;
      const valid = Array.isArray(records) && records.length > 0 && records.some((r) => r?.checked);
      return valid ? true : '請至少確認一項試產檢驗紀錄（或不適用原因）';
    },
  },
  {
    id: 'trialReport.yieldReport',
    stepKey: 'trialReport',
    fieldKey: 'yieldReport',
    label: '良率報告確認',
    owner: 'qa',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const ready = data?.trialReport?.yieldReport?.ready;
      return ready ? true : 'SMT 良率報告是必要文件，請確認完成';
    },
  },
  {
    id: 'trialReport.photoRecords',
    stepKey: 'trialReport',
    fieldKey: 'photoRecords',
    label: '照片紀錄確認',
    owner: 'qa',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const records = data?.trialReport?.photoRecords;
      const valid = Array.isArray(records) && records.length > 0 && records.some((r) => r?.checked);
      return valid ? true : '請至少確認一項試產照片紀錄（或不適用原因）';
    },
  },

  // ── 步驟 9: 工程文件確認 (documents) ──
  {
    id: 'documents.fileConfirm',
    stepKey: 'documents',
    fieldKey: 'documents',
    label: '工程文件清單確認',
    owner: 'rd',
    severity: 'error',
    when: () => true,
    validate: (data) => {
      const docs = data?.basicInfo?.documents || {};
      const requiredKeys = [
        'bom', 'gerber', 'coordinate', 'placement', 'materialSpec',
        'reflowProfile', 'assemblyPackingSop', 'testSop',
      ];
      const missing = requiredKeys.filter((k) => !docs[k]);
      if (missing.length > 0) {
        return `尚有 ${missing.length} 份工程文件未確認已提供或不適用`;
      }
      return true;
    },
  },
];

/**
 * 取得指定資料下所有適用的防呆規則清單
 * @param {Object} data 
 * @returns {Array}
 */
export function getApplicableRules(data) {
  return RULES.filter((rule) => {
    try {
      return rule.when(data);
    } catch {
      return false;
    }
  });
}

/**
 * 全面執行防呆規則驗證，回傳通過數、總數、對齊率與警告清單
 * @param {Object} data 
 * @returns {{ alignmentRate: number, passedChecks: number, totalChecks: number, warnings: Array }}
 */
export function evaluateAllRules(data) {
  const applicableRules = getApplicableRules(data);
  const warnings = [];
  let passedChecks = 0;

  applicableRules.forEach((rule) => {
    let result;
    try {
      result = rule.validate(data);
    } catch (err) {
      result = `檢驗發生例外：${err.message}`;
    }

    if (result === true) {
      passedChecks++;
    } else {
      warnings.push({
        id: rule.id,
        type: rule.severity,
        message: typeof result === 'string' ? result : (rule.label || '欄位驗證未通過'),
        stepKey: rule.stepKey,
        fieldKey: rule.fieldKey,
        owner: rule.owner,
      });
    }
  });

  const totalChecks = applicableRules.length;
  const alignmentRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return {
    alignmentRate,
    passedChecks,
    totalChecks,
    warnings,
  };
}

/**
 * 取得特定步驟之完成狀態 (適用、已完成、進行中、未開始)
 * @param {Object} data 
 * @param {string} stepKey 
 * @returns {{ state: 'done' | 'inProgress' | 'pending', applicable: boolean, total: number, passed: number }}
 */
export function evaluateStepStatus(data, stepKey) {
  const stepRules = RULES.filter((r) => r.stepKey === stepKey);
  const applicableStepRules = stepRules.filter((r) => {
    try {
      return r.when(data);
    } catch {
      return false;
    }
  });

  if (applicableStepRules.length === 0) {
    return { state: 'done', applicable: false, total: 0, passed: 0 };
  }

  let passed = 0;
  applicableStepRules.forEach((rule) => {
    try {
      if (rule.validate(data) === true) passed++;
    } catch {
      // ignore
    }
  });

  if (passed === applicableStepRules.length) {
    return { state: 'done', applicable: true, total: applicableStepRules.length, passed };
  }
  return {
    state: passed > 0 ? 'inProgress' : 'pending',
    applicable: true,
    total: applicableStepRules.length,
    passed,
  };
}
