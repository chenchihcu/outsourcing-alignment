import { Fragment } from 'react';
import PropTypes from 'prop-types';
import { formatTrialReportDisplayName } from './TrialReportSection';
import './PrintReport.css';

function cleanXrayPart(part) {
  const value = String(part || '').trim();
  return /_{2,}/.test(value) ? '' : value;
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function isInstructionalMemo(value) {
  const text = String(value || '').trim();
  return /^（?如有特殊焊接、清洗、點膠等要求，請於此說明）?$/.test(text);
}

function formatSignDate(value) {
  if (!value) return '系統未記錄';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWithUnit(val, unit) {
  if (val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '—') {
    return '(未填寫)';
  }
  return `${String(val).trim()} ${unit}`;
}

function renderFixtureQty(fixture) {
  if (fixture?.need) {
    return fixture.qty ? String(fixture.qty).trim() : '(未填寫)';
  }
  if (fixture?.noNeed) {
    return '不需要';
  }
  return '(未填寫)';
}

function formatPhotoRecordName(rec) {
  if (!rec?.isXray || !Array.isArray(rec.parts)) return rec?.name || '';

  const partsStr = rec.parts.map(cleanXrayPart).filter(Boolean).join(', ');
  const hasKeyword = String(rec.name).includes('指定零件');
  const baseName = hasKeyword
    ? String(rec.name).split(/指定零件/)[0] + '指定零件:'
    : String(rec.name) + '指定零件:';

  return partsStr ? `${baseName} ${partsStr}` : baseName;
}

export default function PrintReport({ data }) {
  if (!data) return null;

  const bi = data.basicInfo || {};
  const pc = data.processControl || {};
  const tr = data.trialReport || {};
  const printRecords = Array.isArray(tr.printRecords) ? tr.printRecords : [];
  const inspectRecords = Array.isArray(tr.inspectRecords) ? tr.inspectRecords : [];
  const photoRecords = Array.isArray(tr.photoRecords) ? tr.photoRecords : [];
  const tooling = bi.tooling || {};
  const sign = bi.signOff || {};
  const stencilApertureRatio = pc.smtFirstPiece?.stencilApertureRatio || tooling.stencil?.apertureRatio || '';
  const filledTempPoints = Array.isArray(pc.tempPoints)
    ? pc.tempPoints.filter((pt) => hasText(pt?.pos) || hasText(pt?.desc) || hasText(pt?.memo))
    : [];
  const specialProcessMemo = String(pc.specialProcessMemo || '').trim();
  const shouldShowSpecialProcessMemo = hasText(specialProcessMemo) && !isInstructionalMemo(specialProcessMemo);

  const deliverySections = [
    { label: 'G1. 印刷品質與回焊紀錄 (Printing & Reflow)', records: printRecords, formatName: (rec) => formatTrialReportDisplayName(rec.name) },
    { label: 'G2. 檢驗紀錄 (Inspection Reports)', records: inspectRecords, formatName: (rec) => formatTrialReportDisplayName(rec.name) },
    { label: 'G3. 照片與影像紀錄 (Visual & X-Ray Photos)', records: photoRecords, formatName: formatPhotoRecordName },
  ];

  const pendingItems = [
    ...printRecords
      .filter((rec) => !rec.checked)
      .map((rec) => ({ scope: '試產交付與檢驗紀錄', item: rec.name, status: '未完成' })),
    ...inspectRecords
      .filter((rec) => !rec.checked)
      .map((rec) => ({ scope: '試產交付與檢驗紀錄', item: rec.name, status: '未完成' })),
    ...photoRecords
      .filter((rec) => !rec.checked)
      .map((rec) => ({ scope: '試產交付與檢驗紀錄', item: formatPhotoRecordName(rec), status: '未完成' })),
  ];

  if (pc.keyParts?.has && filledTempPoints.length === 0) {
    pendingItems.push({
      scope: 'SMT 製程條件',
      item: '測溫點配置',
      status: '已勾選關鍵零件要求，測溫點位置尚未填寫',
    });
  }

  if (!pc.packagingType) {
    pendingItems.push({
      scope: '出貨與保護條件',
      item: '包材種類',
      status: '未選擇',
    });
  }

  [
    ['RD', '研發確認簽核', sign.rdSignature],
    ['PE', '工程審核簽核', sign.engineeringReviewSignature],
    ['QA', '品保處最後審核', sign.qaSignature],
  ].forEach(([role, item, signature]) => {
    if (!signature) {
      pendingItems.push({
        scope: '線上簽核',
        item: `${item} (${role})`,
        status: '待簽章',
      });
    }
  });

  const renderCheck = (checked, label = '') => (
    <span className={`print-checkbox-item ${checked ? 'is-checked' : 'is-unchecked'}`}>
      <span className="checkbox-square">{checked ? '✓' : ''}</span>
      {label && <span className="print-checkbox-label">{label}</span>}
    </span>
  );

  const renderPackagingChecks = (packagingType, packagingData) => (
    <div>
      <div className="print-inline-title">{packagingType === 'fpca' ? 'FPC / FPCA 包材' : 'PCBA 包材'}</div>
      <div className="print-checkbox-grid">
        {renderCheck(packagingData?.staticBag, '靜電袋')}
        {renderCheck(packagingData?.honeycomb, '蜂巢式抗靜電隔板')}
        {renderCheck(packagingData?.tray, '抗靜電托盤 (ESD Tray)')}
        {renderCheck(packagingData?.sensorCover, '感測器保護膜 (Sensor Protective Film)')}
        {renderCheck(packagingData?.cameraCover, '鏡頭保護膜 (Camera Protective Film)')}
      </div>
    </div>
  );

  return (
    <div className="print-report-container">
      <div className="print-header">
        <h1 className="print-title">新機種委外防呆簽核報告</h1>
        <p className="print-subtitle">SMT 生產前置確認 checklist</p>
      </div>

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">A. 產品資料與製程範圍</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="cell-label" style={{ width: '15%' }}>委外加工廠</td>
              <td className="cell-value" style={{ width: '35%' }}>{bi.factory || '(未填寫)'}</td>
              <td className="cell-label" style={{ width: '15%' }}>產品料號</td>
              <td className="cell-value" style={{ width: '35%' }}>{bi.productNo || '(未填寫)'}</td>
            </tr>
            <tr>
              <td className="cell-label">產品名稱/描述</td>
              <td className="cell-value">{bi.productDesc || '(未填寫)'}</td>
              <td className="cell-label">產品階段</td>
              <td className="cell-value">
                {renderCheck(bi.stage?.evt, 'EVT (工程驗證)')}
                {renderCheck(bi.stage?.dvt, 'DVT (設計驗證)')}
                {renderCheck(bi.stage?.pvt, 'PVT (生產驗證)')}
                {renderCheck(bi.stage?.politRun, '試產 (Pilot Run)')}
                {renderCheck(bi.stage?.mp, '量產 (MP)')}
                {bi.ecnChange?.has && (
                  <span className="print-checkbox-item is-checked">
                    <span className="checkbox-square">✓</span>
                    <span className="print-checkbox-label">工程變更 (ECN)</span>
                  </span>
                )}
                {bi.ecnChange?.has && bi.ecnChange?.verificationItem && (
                  <div className="print-field-note">驗證項目: {bi.ecnChange.verificationItem}</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 新增: 品質標準與加工項目 (步驟 2，修復 D-127 / R5-2) */}
      <section className="print-section print-flow-section">
        <h2 className="print-section-title">A1. 品質標準與加工管制</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="cell-label" style={{ width: '20%' }}>品質水準要求</td>
              <td className="cell-value" style={{ width: '30%' }}>
                {renderCheck(bi.qualityLevel?.class2, 'Class 2 (一般電子)')}
                {renderCheck(bi.qualityLevel?.class3, 'Class 3 (高可靠度)')}
              </td>
              <td className="cell-label" style={{ width: '20%' }}>IPC 驗收標準</td>
              <td className="cell-value" style={{ width: '30%' }}>
                {renderCheck(bi.ipcStandard?.ipcA610, 'IPC-A-610 (外觀驗收)')}
                {renderCheck(bi.ipcStandard?.jStd001, 'J-STD-001 (焊接製造)')}
              </td>
            </tr>
            <tr>
              <td className="cell-label">製程管制需求</td>
              <td className="cell-value" colSpan={3}>
                {renderCheck(bi.glue, '點膠防護')}
                {renderCheck(bi.qrCode?.need, 'QR Code 二維條碼掃描')}
                {renderCheck(bi.snControl?.need, '單板序號管控 (S/N Traceability)')}
                {renderCheck(bi.aoi?.top, 'AOI Top (頂面)')}
                {renderCheck(bi.aoi?.bottom, 'AOI Bottom (底面)')}
              </td>
            </tr>
            <tr>
              <td className="cell-label">主要加工項目</td>
              <td className="cell-value" colSpan={3}>
                <div className="print-checkbox-grid">
                  {renderCheck(bi.processItems?.smt, 'SMT 表面黏著')}
                  {renderCheck(bi.processItems?.dip, 'DIP 通孔插裝')}
                  {renderCheck(bi.processItems?.ict, 'ICT 線路測試 (In-Circuit Test)')}
                  {renderCheck(bi.processItems?.assembly, '組裝 (Assembly)')}
                  {renderCheck(bi.processItems?.coating, 'Conformal Coating 防潮絕緣塗覆')}
                  {renderCheck(bi.processItems?.packing, '包裝 (Packing)')}
                  {renderCheck(bi.processItems?.fct, 'FCT 功能測試')}
                  {renderCheck(bi.processItems?.flyingProbe, '飛針測試 (Flying Probe)')}
                  {renderCheck(bi.processItems?.underfillGlue, 'Underfill 底部填膠')}
                  {renderCheck(bi.processItems?.semiFinishedTest, '半成品功能測試')}
                  {renderCheck(bi.processItems?.finalTest, '成品全功能測試')}
                  {renderCheck(bi.processItems?.otherProcess, `其他: ${bi.processItems?.otherProcessText || ''}`)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">B. 製程前置條件</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="cell-label" style={{ width: '20%' }}>樣品提供確認</td>
              <td className="cell-value" colSpan={3}>
                {renderCheck(pc.sampleProvided?.trialBoard, '試錫空板 (Dummy Board)')}
                {renderCheck(pc.sampleProvided?.tempBoard, '測溫板 (Thermal Profile Board)')}
                {renderCheck(pc.sampleProvided?.standardPart, '標準件 / 黃金樣板 (Golden Sample)')}
              </td>
            </tr>
            <tr>
              <td className="cell-label">PCB / FPC 裸板預烘烤去濕需求</td>
              <td className="cell-value" colSpan={3}>
                {renderCheck(pc.bakeRequired?.need, '需要預烘烤')}
                {renderCheck(pc.bakeRequired?.noNeed, '不需要')}
                {pc.bakeRequired?.need && (
                  <div className="print-field-note">
                    PCB 裸板烘烤條件: {pc.bakeRequired?.pcbBakeCond || '(未填寫)'}<br />
                    FPC 裸板烘烤條件: {pc.bakeRequired?.fpcaBakeCond || '(未填寫)'}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">C. 鋼網與治工具確認</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '28%' }}>治工具名稱</th>
              <th scope="col" style={{ width: '54%' }}>規格描述 / 加工廠確認</th>
              <th scope="col" style={{ width: '18%' }}>提供數量</th>
            </tr>
          </thead>
          <tbody>
            {bi.processItems?.smt && (
              <tr>
                <td className="cell-bold">SMT 鋼網 (Stencil)</td>
                <td>
                  {renderCheck(true, '鋼網規格 (100% 需要)')}
                  <div className="print-field-note">
                    厚度: <strong>{formatWithUnit(tooling.stencil?.thickness, 'mm')}</strong> |
                    樣式: <strong>{tooling.stencil?.style === 'step' ? '階梯鋼網 (Step Stencil)' : '一般平整鋼網'}</strong>
                    {tooling.stencil?.nanoCoating && <span className="nano-coating-badge">表面奈米塗層 (Nano Coating)</span>}
                  </div>
                </td>
                <td>—</td>
              </tr>
            )}
            <tr>
              <td className="cell-bold">分板治具 (Router Fixture)</td>
              <td>{renderCheck(tooling.routingFixture?.need, '需要')}{renderCheck(tooling.routingFixture?.noNeed, '不需要')}</td>
              <td>{renderFixtureQty(tooling.routingFixture)}</td>
            </tr>
            <tr>
              <td className="cell-bold">點膠 / 塗膠治具</td>
              <td>{renderCheck(tooling.glueFixture?.need, '需要')}{renderCheck(tooling.glueFixture?.noNeed, '不需要')}</td>
              <td>{renderFixtureQty(tooling.glueFixture)}</td>
            </tr>
            <tr>
              <td className="cell-bold">測試治具 (ICT / FCT)</td>
              <td>{renderCheck(tooling.testFixture?.need, '需要')}{renderCheck(tooling.testFixture?.noNeed, '不需要')}</td>
              <td>{renderFixtureQty(tooling.testFixture)}</td>
            </tr>
            <tr>
              <td className="cell-bold">組裝治具 (Assembly Fixture)</td>
              <td>{renderCheck(tooling.assemblyFixture?.need, '需要')}{renderCheck(tooling.assemblyFixture?.noNeed, '不需要')}</td>
              <td>{renderFixtureQty(tooling.assemblyFixture)}</td>
            </tr>
            <tr>
              <td className="cell-bold">SMT 印刷 / 回焊載具 (Carrier)</td>
              <td>
                {renderCheck(tooling.smtCarrier?.need, '需要')}
                {renderCheck(tooling.smtCarrier?.noNeed, '不需要')}
                {tooling.smtCarrier?.need && (
                  <div className="print-field-note">
                    選項: {renderCheck(tooling.smtCarrier?.upper, '頂層上載具 (Top Carrier)')}{renderCheck(tooling.smtCarrier?.lower, '底層下載具 (Bottom Carrier)')}
                  </div>
                )}
              </td>
              <td>{tooling.smtCarrier?.need ? '需要' : (tooling.smtCarrier?.noNeed ? '不需要' : '(未填寫)')}</td>
            </tr>
            <tr>
              <td className="cell-bold">其他特殊治具</td>
              <td>
                {renderCheck(tooling.otherFixture?.need, '需要')}
                {renderCheck(tooling.otherFixture?.noNeed, '不需要')}
                {tooling.otherFixture?.need && (
                  <div className="print-field-note">名稱: <strong>{tooling.otherFixture?.name || '(未填寫)'}</strong></div>
                )}
              </td>
              <td>{renderFixtureQty(tooling.otherFixture)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">D. SMT 製程條件</h2>
        <table className="print-table">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '45%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="cell-label">SMT 焊接順序</td>
              <td className="cell-value">
                <div className="print-checkbox-vertical">
                  {renderCheck(pc.smtOrder?.bToT, '先焊底面 (B→T)')}
                  {renderCheck(pc.smtOrder?.tToB, '先焊頂面 (T→B)')}
                </div>
              </td>
              <td className="cell-label">鋼網開孔縮放比例</td>
              <td className="cell-value">{stencilApertureRatio ? `${stencilApertureRatio}%` : '(未填寫)'}</td>
            </tr>
            <tr>
              <td className="cell-label">SMT 首件檢查項目</td>
              <td className="cell-value" colSpan={3}>
                <div className="print-checkbox-grid">
                  {renderCheck(pc.smtFirstPiece?.polarity, '元件極性與方向檢查 (Polarity & Orientation)')}
                  {renderCheck(pc.smtFirstPiece?.measureLcr, '首件 LCR 電氣參數確認')}
                  {renderCheck(pc.smtFirstPiece?.spi, 'SPI 錫膏檢查 (厚度/面積/體積)')}
                  {renderCheck(pc.smtFirstPiece?.steelTension, '鋼網張力量測 (Stencil Tension)')}
                  {renderCheck(pc.smtFirstPiece?.ledTest === 'yes', 'LED 點亮與發光檢查: 有')}
                  {renderCheck(pc.smtFirstPiece?.ledTest === 'no', 'LED 點亮與發光檢查: 無 (不適用)')}
                  {renderCheck(pc.smtFirstPiece?.pcbReflow, '迴焊後外觀檢查 (Post-Reflow)')}
                  {renderCheck(pc.smtFirstPiece?.solderability, '潤濕性 / 沾錫性檢查 (Solder Wetting)')}
                </div>
              </td>
            </tr>
            {bi.processItems?.dip && (
              <>
                <tr>
                  <td className="cell-label">DIP 首件檢查項目</td>
                  <td className="cell-value">{renderCheck(pc.dipFirstPiece?.cutLead, '引腳預成型與剪腳作業 (Lead Forming & Trimming)')}</td>
                  <td className="cell-label">DIP 焊接順序</td>
                  <td className="cell-value">
                    <div className="print-checkbox-vertical">
                      {renderCheck(pc.dipOrder?.bToT, '先焊底面 (B→T)')}
                      {renderCheck(pc.dipOrder?.tToB, '先焊頂面 (T→B)')}
                    </div>
                  </td>
                </tr>
                {pc.dipFirstPiece?.memo && (
                  <tr>
                    <td className="cell-label">DIP 注意事項</td>
                    <td className="cell-value" colSpan={3}>{pc.dipFirstPiece.memo}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </section>

      {pc.keyParts?.has && (
        <section className="print-subsection-block print-flow-section">
          <h3 className="print-sub-section-title">D1. 測溫點配置 (關鍵零件要求)</h3>
          {filledTempPoints.length > 0 ? (
            <table className="print-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '8%' }}>#</th>
                  <th scope="col" style={{ width: '32%' }}>位置 / 位號</th>
                  <th scope="col" style={{ width: '30%' }}>零件描述</th>
                  <th scope="col" style={{ width: '30%' }}>備註</th>
                </tr>
              </thead>
              <tbody>
                {filledTempPoints.map((pt, idx) => (
                  <tr key={`${pt.pos || pt.desc || 'temp'}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{pt.pos || '—'}</td>
                    <td>{pt.desc || '—'}</td>
                    <td>{pt.memo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="print-memo-box print-warning-box">已勾選關鍵零件要求，測溫點位置尚未填寫。</div>
          )}
        </section>
      )}

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">E. 特殊製程條件</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="cell-label" style={{ width: '20%' }}>Underfill 熱固化條件 (Thermal Curing)</td>
              <td className="cell-value" style={{ width: '30%' }}>
                {(pc.underfill?.bakeTemp && pc.underfill?.bakeTime)
                  ? `${pc.underfill?.bakeTemp} °C x ${pc.underfill?.bakeTime} min`
                  : (bi.processItems?.underfillGlue ? '(未填寫)' : '不適用')}
              </td>
              <td className="cell-label" style={{ width: '20%' }}>膠材型號</td>
              <td className="cell-value" style={{ width: '30%' }}>
                {pc.underfill?.glueModel || (bi.processItems?.underfillGlue ? '(未填寫)' : '不適用')}
              </td>
            </tr>
          </tbody>
        </table>
        {shouldShowSpecialProcessMemo && (
          <div className="print-subsection-block print-flow-section">
            <h3 className="print-sub-section-title">E1. 特殊製程備註</h3>
            <div className="print-memo-box">{specialProcessMemo}</div>
          </div>
        )}
      </section>

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">F. 出貨與保護條件</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="cell-label" style={{ width: '20%' }}>包材種類</td>
              <td className="cell-value" colSpan={3}>
                {pc.packagingType === 'pcba' && renderPackagingChecks('pcba', pc.pcbaPackaging)}
                {pc.packagingType === 'fpca' && renderPackagingChecks('fpca', pc.fpcaPackaging)}
                {!pc.packagingType && <span className="text-danger">未選擇</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="print-section print-flow-section">
        <h2 className="print-section-title">G. 試產交付與檢驗紀錄</h2>
        <table className="print-table print-long-table print-delivery-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '76%' }}>交付項目 / 檢驗紀錄 / 照片清單</th>
              <th scope="col" style={{ width: '24%' }}>完成狀態</th>
            </tr>
          </thead>
          <tbody>
            {deliverySections.map((section) => (
              <Fragment key={section.label}>
                <tr className="print-subhead-row">
                  <td className="cell-subhead" colSpan={2}>{section.label}</td>
                </tr>
                {section.records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="delivery-item print-long-text-cell">{section.formatName ? section.formatName(rec) : rec.name}</td>
                    <td className="text-center print-status-cell">
                      {rec.checked ? (
                        <span className="badge badge-success print-status-badge">已完成 ✓</span>
                      ) : (
                        <span className="badge badge-danger print-status-badge">未完成 —</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section print-pending-section">
        <h2 className="print-section-title">H. 未完成與待確認項目</h2>
        <table className="print-table print-pending-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '24%' }}>範圍</th>
              <th scope="col" style={{ width: '56%' }}>項目</th>
              <th scope="col" style={{ width: '20%' }}>狀態</th>
            </tr>
          </thead>
          <tbody>
            {pendingItems.length > 0 ? (
              pendingItems.map((item, idx) => (
                <tr key={`${item.scope}-${item.item}-${idx}`}>
                  <td>{item.scope}</td>
                  <td className="print-long-text-cell">{item.item}</td>
                  <td className="print-status-cell"><span className="badge badge-danger print-status-badge">{item.status}</span></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-center">目前無未完成與待確認項目</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="print-section print-sign-section">
        <h2 className="print-section-title sign-section-title">I. 線上簽核記錄</h2>
        <div className="print-sign-grid">
          <div className={`print-sign-box role-rd ${sign.rdSignature ? 'is-signed' : 'is-unsigned'}`}>
            <div className="print-sign-header">研發確認簽核 (RD)</div>
            <div className="print-sign-body">
              <div className="print-sign-name">
                {sign.rdSignature ? (
                  <img src={sign.rdSignature} alt="RD Signature" />
                ) : (
                  <span className="sign-text text-danger">⚠ 待研發確認簽章</span>
                )}
              </div>
              <div className="print-sign-date">系統紀錄簽名日期: {sign.rdSignature ? formatSignDate(sign.rdSignedAt) : '未簽章'}</div>
              <div className="print-sign-terms">確認產品基本資料與風險零件已填寫完整，並經研發部門核准。</div>
            </div>
          </div>

          <div className={`print-sign-box role-pe ${sign.engineeringReviewSignature ? 'is-signed' : 'is-unsigned'}`}>
            <div className="print-sign-header">工程審核簽核 (PE)</div>
            <div className="print-sign-body">
              <div className="print-sign-name">
                {sign.engineeringReviewSignature ? (
                  <img src={sign.engineeringReviewSignature} alt="PE Signature" />
                ) : (
                  <span className="sign-text text-danger">⚠ 待工程審核簽章</span>
                )}
              </div>
              <div className="print-sign-date">系統紀錄簽名日期: {sign.engineeringReviewSignature ? formatSignDate(sign.engineeringReviewSignedAt) : '未簽章'}</div>
              <div className="print-sign-terms">確認生產治工具規格、鋼網開孔以及製程工程參數已審查通過。</div>
            </div>
          </div>

          <div className={`print-sign-box role-qa ${sign.qaSignature ? 'is-signed' : 'is-unsigned'}`}>
            <div className="print-sign-header">品保處最後審核 (QA)</div>
            <div className="print-sign-body">
              <div className="print-sign-name">
                {sign.qaSignature ? (
                  <img src={sign.qaSignature} alt="QA Signature" />
                ) : (
                  <span className="sign-text text-danger">⚠ 待品保處審核簽章</span>
                )}
              </div>
              <div className="print-sign-date">系統紀錄簽名日期: {sign.qaSignature ? formatSignDate(sign.qaSignedAt) : '未簽章'}</div>
              <div className="print-sign-terms">確認項目已完成填寫與覆核，符合試產要求。</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

PrintReport.propTypes = {
  data: PropTypes.object.isRequired,
};
