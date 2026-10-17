import { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { validateAlignment } from '../utils/validator';
import { exportRequirementExcel } from '../utils/excelExporter';
import { compressImage } from '../utils/imageCompressor';
import { isSignOffComplete, getSignOffMissingItems } from '../utils/signOffStatus';
import './SignOff.css';

const SIGNED_AT_FIELDS = {
  rdSignature: 'rdSignedAt',
  engineeringReviewSignature: 'engineeringReviewSignedAt',
  qaSignature: 'qaSignedAt',
};

export default function SignOff({
  data,
  originalWb,
  fileName,
  onChange,
  onExportComplete,
  currentUser,
  onUpdateAccountSignature,
  onFinalExit,
  onFinalBackToList,
  onPrev,
}) {
  const report = useMemo(() => validateAlignment(data), [data]);
  const { alignmentRate, warnings } = report;
  const [exportLoading, setExportLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const exportTimerRef = useRef(null);
  const printTimerRef = useRef(null);
  const rdUploadRef = useRef(null);
  const peUploadRef = useRef(null);
  const qaUploadRef = useRef(null);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current) {
        clearTimeout(exportTimerRef.current);
        exportTimerRef.current = null;
      }
      if (printTimerRef.current) {
        clearTimeout(printTimerRef.current);
        printTimerRef.current = null;
      }
    };
  }, []);

  const warningsList = report?.warnings || [];
  const hasBlockingErrors = warningsList.some(it => it.type === 'error');
  const blockingErrorsCount = warningsList.filter(it => it.type === 'error').length;

  // ===== 品保退件流程(硬性鎖定)=====
  const signOff = data.basicInfo?.signOff || {};
  const rejection = signOff.rejection || null;
  const isRejected = !!rejection;
  // D-116: 必須所有適用步驟完成且 RD、PE、QA 三方均已簽章且無退件才算最終簽核完成
  const finalApprovalComplete = isSignOffComplete(data);
  const missingItems = useMemo(() => getSignOffMissingItems(data), [data]);
  const isQA = currentUser.role === 'qa' || currentUser.role === 'admin';
  const canResubmit = currentUser.role === 'rd' || currentUser.role === 'eng' || currentUser.role === 'admin';
  const [rejectReason, setRejectReason] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');
  const [rejectionRead, setRejectionRead] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const [resubmitError, setResubmitError] = useState('');
  const [exportError, setExportError] = useState('');
  const [printError, setPrintError] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  const fmtDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // QA 退件:記錄原因並作廢三方簽章(修正後須重新簽核，D-109 累計歷程)
  const handleReject = () => {
    const reason = rejectReason.trim();
    if (!reason) { setRejectError('請填寫退件原因。'); return; }
    setRejectError('');
    const historyItem = {
      type: 'reject',
      reason,
      by: currentUser.username,
      byUnit: currentUser.unit,
      at: new Date().toISOString()
    };
    const currentHistory = Array.isArray(signOff.signOffHistory) ? signOff.signOffHistory : [];
    const updatedSign = {
      ...data.basicInfo.signOff,
      rejection: { reason, by: currentUser.username, byUnit: currentUser.unit, at: historyItem.at },
      signOffHistory: [...currentHistory, historyItem],
      rdSignature: '',
      engineeringReviewSignature: '',
      qaSignature: '',
      rdSignedAt: '',
      engineeringReviewSignedAt: '',
      qaSignedAt: '',
      rejectionResponse: undefined,
    };
    const owners = { ...(data._owners || {}) };
    delete owners['basicInfo.signOff.rdSignature'];
    delete owners['basicInfo.signOff.engineeringReviewSignature'];
    delete owners['basicInfo.signOff.qaSignature'];
    onChange({ ...data, basicInfo: { ...data.basicInfo, signOff: updatedSign }, _owners: owners });
    setRejectReason('');
  };

  // 發包方修正後重新送審:解除退件鎖定 (D-109 累計歷程)
  const handleResubmit = () => {
    setResubmitError('');
    if (!rejection) { setResubmitError('退件資訊遺失，無法執行重新送審。'); return; }
    if (!resubmitNote.trim()) { setResubmitError('請填寫「修正說明」，說明本次修正了哪些內容。'); return; }
    if (!rejectionRead) { setResubmitError('請勾選「已閱讀退件原因並完成修正」後才可重新送審。'); return; }
    const historyItem = {
      type: 'resubmit',
      note: resubmitNote.trim(),
      by: currentUser.username,
      byUnit: currentUser.unit,
      at: new Date().toISOString()
    };
    const currentHistory = Array.isArray(signOff.signOffHistory) ? signOff.signOffHistory : [];
    const updatedSign = {
      ...data.basicInfo.signOff,
      signOffHistory: [...currentHistory, historyItem],
      rejectionResponse: { note: resubmitNote.trim(), by: currentUser.username, at: historyItem.at }
    };
    delete updatedSign.rejection;
    onChange({ ...data, basicInfo: { ...data.basicInfo, signOff: updatedSign } });
    setResubmitNote('');
    setRejectionRead(false);
  };

  const handleSignChange = (field, val) => {
    // D-25: 一般角色尚有 error 級必填檢查未完成時，阻擋簽章
    if (val && hasBlockingErrors && currentUser?.role !== 'admin') {
      setExportError(`尚有 ${blockingErrorsCount} 項必填檢查未完成，無法簽章。請先至前面步驟完成填寫。`);
      return;
    }
    const signedAtField = SIGNED_AT_FIELDS[field];
    const updatedSign = { ...data.basicInfo.signOff, [field]: val };
    if (signedAtField) {
      updatedSign[signedAtField] = val ? new Date().toISOString() : '';
    }
    const updatedBasic = { ...data.basicInfo, signOff: updatedSign };
    const path = `basicInfo.signOff.${field}`;
    const owners = { ...(data._owners || {}) };
    if (val !== '') {
      owners[path] = currentUser.unit;
    } else {
      delete owners[path];
    }
    onChange({ ...data, basicInfo: updatedBasic, _owners: owners });
  };

  const handleExport = () => {
    if (exportLoading) return;
    setExportError('');
    // D-25: 一般角色尚有 error 級必填檢查未完成時，阻擋匯出
    if (hasBlockingErrors && currentUser?.role !== 'admin') {
      setExportError(`尚有 ${blockingErrorsCount} 項必填檢查未完成，無法匯出正式 Excel。請先完成所有必填項目。`);
      return;
    }
    if (!originalWb) {
      setExportError('無法匯出：缺少原始 Excel 範本資料。請重新載入機種或從範本重新建立。');
      return;
    }
    // D8 — 匯出前驗證簽章圖片格式
    const sigs = data.basicInfo?.signOff || {};
    for (const k of ['rdSignature', 'engineeringReviewSignature', 'qaSignature']) {
      if (sigs[k] && !String(sigs[k]).startsWith('data:image/')) {
        setExportError(`匯出失敗：${k} 簽章圖片格式無效，請重新上傳簽章。`);
        return;
      }
    }
    setExportLoading(true);

    if (exportTimerRef.current) {
      clearTimeout(exportTimerRef.current);
    }

    exportTimerRef.current = setTimeout(() => {
      try {
        const outArray = exportRequirementExcel(originalWb, data);
        
        const blob = new Blob([outArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `${fileName}_對齊簽核版.xlsx`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setExportSuccess(true);
        onExportComplete();
      } catch (err) {
        console.error(err);
        setExportError('匯出 Excel 檔案出錯！');
      } finally {
        setExportLoading(false);
        exportTimerRef.current = null;
      }
    }, 1000);
  };

  const handlePrintReport = () => {
    if (printLoading) return;
    setPrintError('');
    setPrintLoading(true);

    const resetPrintLoading = () => {
      if (printTimerRef.current) {
        clearTimeout(printTimerRef.current);
        printTimerRef.current = null;
      }
      setPrintLoading(false);
    };

    try {
      const reportNode = document.querySelector('.print-report-container');
      if (!reportNode) {
        setPrintError('列印報表尚未載入完成，請稍候再試一次。');
        resetPrintLoading();
        return;
      }

      if (typeof window.print !== 'function') {
        setPrintError('此瀏覽器不支援網頁列印，請改用瀏覽器的分享/列印功能或桌面版 Chrome。');
        resetPrintLoading();
        return;
      }

      window.print();
      printTimerRef.current = setTimeout(resetPrintLoading, 1000);
    } catch (err) {
      console.error(err);
      setPrintError('列印視窗開啟失敗，請稍後再試一次。');
      resetPrintLoading();
    }
  };

  const hasMissingCritical = warnings.some(w => w.type === 'error');

  return (
    <div className="signoff-container glass-card animate-fade-in">
      <h2 className="section-title">簽章與匯出</h2>

      {/* D-25: 阻擋未完成項目簽核與匯出提示橫幅 */}
      {hasBlockingErrors && (
        <div className="blocking-warning-banner pokayoke-summary pokayoke-bar" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#991b1b' }}>
          <strong>⚠️ 尚有 {blockingErrorsCount} 項必填檢查未完成</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>必須先至前面步驟完成所有防呆必填項目，方可套用簽章或匯出正式需求表。</p>
        </div>
      )}

      {/* 品保退件提示(硬性鎖定:簽章與匯出皆已封鎖) */}
      {isRejected && (
        <div className="reject-banner rejected-banner" role="alert">
          <div className="reject-banner-main">
            <span className="reject-icon">⛔</span>
            <div className="reject-text">
              <p className="reject-title">此機種已被品保退件 — 簽章與匯出已鎖定</p>
              <p className="reject-reason">退件原因：{rejection.reason}</p>
              <p className="reject-meta">退件人：{rejection.byUnit ? `${rejection.byUnit} · ` : ''}{rejection.by} · {fmtDateTime(rejection.at)}</p>
            </div>
          </div>
          {canResubmit && (
            <div className="resubmit-section">
              <textarea
                className="form-input edit-active resubmit-note"
                placeholder="修正說明（必填）：請說明本次修正了哪些內容…" name="resubmitNote"
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                rows={2}
                style={{ width: '100%', marginTop: '8px', resize: 'vertical' }}
              />
              <label className="resubmit-ack-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rejectionRead}
                  onChange={(e) => setRejectionRead(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                已閱讀退件原因並完成修正
              </label>
              {resubmitError && (
                <div role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px' }}>
                  ⚠️ {resubmitError}
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary reject-resubmit"
                onClick={handleResubmit}
                disabled={!resubmitNote.trim() || !rejectionRead}
                style={{ marginTop: '8px', opacity: (!resubmitNote.trim() || !rejectionRead) ? 0.5 : 1 }}
              >
                ✅ 已修正，重新送審
              </button>
            </div>
          )}
        </div>
      )}

      {/* 資訊對齊狀態 */}
      <div className="status-banner">
        <div className="status-progress-bar-wrapper">
          <div className="status-progress-info">
            <span className="status-label">欄位對齊率</span>
            <span className="status-percentage">{alignmentRate}%</span>
          </div>
          <div className="status-bar-bg">
            <div 
              className="status-bar-fg" 
              style={{ 
                width: `${alignmentRate}%`,
                background: alignmentRate === 100 ? 'var(--success-color)' : 'var(--accent-gradient)'
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* 簽核區塊 */}
      <div className="sign-grid">
        {/* 發包方研發 */}
        <div className="sign-box">
          <div className="sign-header bg-rd">
            <span>研發確認簽章</span>
            <span className="badge-role">研發 (RD)</span>
          </div>
          <div className="sign-body">
            {/* 電子簽章預覽及上傳 */}
            <div className="signature-preview-area">
              <span className="form-label">電子簽章</span>
              <div className="signature-container-preview">
                {data.basicInfo.signOff?.rdSignature ? (
                  <img src={data.basicInfo.signOff.rdSignature} alt="RD Signature" loading="lazy" className="signature-img-preview" onError={(e) => { e.target.style.display = "none" }} />
                ) : (
                  <span className="signature-empty-text">尚未設定電子簽章</span>
                )}
              </div>
              
              {(currentUser.role === 'rd' || currentUser.role === 'admin') && !isRejected && (
                <div className="signature-btn-row">
                  {currentUser.signature && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-xs"
                      onClick={() => {
                        handleSignChange('rdSignature', currentUser.signature);
                      }}
                    >
                      🖋️ 套用我的簽章
                    </button>
                  )}
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg" 
                    ref={rdUploadRef}
                    id="rd-sig-upload" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          try {
                            const compressed = await compressImage(event.target.result);
                            handleSignChange('rdSignature', compressed);
                            onUpdateAccountSignature(currentUser.username, compressed);
                          } catch (err) {
                            setExportError(err.message);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary btn-xs"
                    onClick={() => rdUploadRef.current?.click()}
                  >
                    📤 上傳簽章
                  </button>
                  {data.basicInfo.signOff?.rdSignature && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-xs signature-btn-danger-xs" 
                      onClick={() => handleSignChange('rdSignature', '')}
                      aria-label="移除研發簽章"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="sign-terms">本簽章確認：產品基本資料與風險零件已填寫完整，並經研發部門確認。</p>
          </div>
        </div>

        {/* 發包方工程 */}
        <div className="sign-box">
          <div className="sign-header bg-pe">
            <span>工程審核簽章</span>
            <span className="badge-role">工程 (PE)</span>
          </div>
          <div className="sign-body">
            {/* 電子簽章預覽及上傳 */}
            <div className="signature-preview-area">
              <span className="form-label">電子簽章</span>
              <div className="signature-container-preview">
                {data.basicInfo.signOff?.engineeringReviewSignature ? (
                  <img src={data.basicInfo.signOff.engineeringReviewSignature} alt="PE Signature" loading="lazy" className="signature-img-preview" onError={(e) => { e.target.style.display = "none" }} />
                ) : (
                  <span className="signature-empty-text">尚未設定電子簽章</span>
                )}
              </div>
              
              {(currentUser.role === 'eng' || currentUser.role === 'admin') && !isRejected && (
                <div className="signature-btn-row">
                  {!data.basicInfo.signOff?.rdSignature && currentUser.role !== 'admin' ? (
                    <span style={{ fontSize: '0.8rem', color: '#b45309' }}>⚠️ 需研發 (RD) 先行完成簽章後方可審核</span>
                  ) : (
                    <>
                      {currentUser.signature && (
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            handleSignChange('engineeringReviewSignature', currentUser.signature);
                          }}
                        >
                          🖋️ 套用我的簽章
                        </button>
                      )}
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg" 
                        ref={peUploadRef}
                        id="pe-sig-upload" 
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              try {
                                const compressed = await compressImage(event.target.result);
                                handleSignChange('engineeringReviewSignature', compressed);
                                onUpdateAccountSignature(currentUser.username, compressed);
                              } catch (err) {
                                setExportError(err.message);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-primary btn-xs"
                        onClick={() => peUploadRef.current?.click()}
                      >
                        📤 上傳簽章
                      </button>
                    </>
                  )}
                  {data.basicInfo.signOff?.engineeringReviewSignature && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-xs signature-btn-danger-xs" 
                      onClick={() => handleSignChange('engineeringReviewSignature', '')}
                      aria-label="移除工程簽章"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="sign-terms">本簽章確認：生產治工具規格、鋼板開口以及製程工程參數已審查通過。</p>
          </div>
        </div>

        {/* 品保處審核 */}
        <div className="sign-box">
          <div className="sign-header bg-vendor">
            <span>品保處最後審核</span>
            <span className="badge-role">品保處 (QA)</span>
          </div>
          <div className="sign-body">
            {/* 電子簽章預覽及上傳 */}
            <div className="signature-preview-area">
              <span className="form-label">電子簽章</span>
              <div className="signature-container-preview">
                {data.basicInfo.signOff?.qaSignature ? (
                  <img src={data.basicInfo.signOff.qaSignature} alt="QA Signature" loading="lazy" className="signature-img-preview" onError={(e) => { e.target.style.display = "none" }} />
                ) : (
                  <span className="signature-empty-text">尚未設定電子簽章</span>
                )}
              </div>
              
              {(currentUser.role === 'qa' || currentUser.role === 'admin') && !isRejected && (
                <div className="signature-btn-row">
                  {!data.basicInfo.signOff?.engineeringReviewSignature && currentUser.role !== 'admin' ? (
                    <span style={{ fontSize: '0.8rem', color: '#b45309' }}>⚠️ 需工程 (PE) 先行完成簽章後方可簽核</span>
                  ) : (
                    <>
                      {currentUser.signature && (
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            handleSignChange('qaSignature', currentUser.signature);
                          }}
                        >
                          🖋️ 套用我的簽章
                        </button>
                      )}
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg" 
                        ref={qaUploadRef}
                        id="qa-sig-upload" 
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              try {
                                const compressed = await compressImage(event.target.result);
                                handleSignChange('qaSignature', compressed);
                                onUpdateAccountSignature(currentUser.username, compressed);
                              } catch (err) {
                                setExportError(err.message);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-primary btn-xs"
                        onClick={() => qaUploadRef.current?.click()}
                      >
                        📤 上傳簽章
                      </button>
                    </>
                  )}
                  {data.basicInfo.signOff?.qaSignature && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-xs signature-btn-danger-xs" 
                      onClick={() => handleSignChange('qaSignature', '')}
                      aria-label="移除品保簽章"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {(!data.basicInfo.signOff?.rdSignature || !data.basicInfo.signOff?.engineeringReviewSignature) ? (
              <p className="sign-terms" style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                ⚠️ 建議等研發與工程完成簽章後再進行最終審核，但目前不強制阻擋。
              </p>
            ) : (
              <p className="sign-terms">本簽章確認：確認項目已完成填寫與覆核，符合試產要求。</p>
            )}

            {/* QA 退件控制(僅品保、且尚未退件時):常駐的「退件原因」欄位 */}
            {isQA && !isRejected && (
              <div className="qa-reject-control">
                <label htmlFor="reject-reason" className="form-label reject-label">退件原因 <span className="req">*</span>（如需退件，請於下方說明原由）</label>
                <textarea
                  id="reject-reason"
                  className="form-textarea reject-textarea"
                  rows={3}
                  placeholder="例：製程管制分頁的 SMT 焊接順序與測溫點配置尚未填寫，請補齊後重新送審。" name="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                {rejectError && (
                  <div role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px' }}>
                    ⚠️ {rejectError}
                  </div>
                )}
                <div className="reject-form-actions">
                  <button type="button" className="btn btn-xs reject-confirm" onClick={handleReject}>
                    ⛔ 退件並要求修正
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 匯出警示防呆 */}
      {isRejected ? (
        <div className="export-warning reject-locked">
          <span className="warning-emoji">⛔</span>
          <div className="warning-desc">
            <p className="warning-title">已被品保退件，簽章與匯出已鎖定</p>
            <p className="warning-detail">請發包方(研發 / 工程)依退件原因完成修正後，點擊上方「重新送審」解除鎖定，再重新進行三方簽章與匯出。</p>
          </div>
        </div>
      ) : hasMissingCritical ? (
        <div className="export-warning">
          <span className="warning-emoji">⚠️</span>
          <div className="warning-desc">
            <p className="warning-title">注意：尚有必填的防呆檢查未完成！</p>
            <p className="warning-detail">為了避免供應商取得不完整資訊，建議先前往前述分頁補齊。若仍需簽章並匯出，請點擊下方按鈕。</p>
          </div>
        </div>
      ) : (
        <div className="export-success">
          <span className="success-emoji">🎉</span>
          <div className="success-desc">
            <p className="success-title">確認項目已完成</p>
            <p className="success-detail">所有必填與關鍵管制點皆已填寫，可匯出最終簽章版文件。</p>
          </div>
        </div>
      )}

      {finalApprovalComplete ? (
        <div className="final-approval-next" aria-live="polite">
          <div className="final-approval-copy">
            <span className="final-approval-kicker">最終簽核已完成</span>
            <p>目前機種會先自動儲存，再依您的選擇離開系統或回到機種管理中心。</p>
          </div>
          <div className="final-approval-actions">
            <button
              type="button"
              className="btn btn-secondary final-exit-btn"
              onClick={onFinalExit}
            >
              儲存後離開系統
            </button>
            <button
              type="button"
              className="btn btn-primary final-center-btn"
              onClick={onFinalBackToList}
            >
              回到機種管理中心
            </button>
          </div>
        </div>
      ) : (
        <div className="signoff-pending-banner" style={{ margin: '16px 0', padding: '14px 18px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid #f59e0b', borderRadius: '8px' }}>
          <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '6px' }}>
            ⏳ 尚未完成最終簽核：
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', fontSize: '0.88rem' }}>
            {missingItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 匯出動作按鈕 */}
      <div className="export-action-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {onPrev && (
            <button type="button" className="btn btn-secondary btn-large" onClick={onPrev}>
              上一步：工程文件確認
            </button>
          )}
          <button type="button"
            className="btn btn-primary btn-large"
            onClick={handlePrintReport}
            disabled={isRejected || exportLoading || printLoading || hasBlockingErrors}
          >
            <svg className="download-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '20px', height: '20px', marginRight: '8px' }} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>{printLoading ? '準備列印報表...' : '列印 / 儲存 PDF (A4直式)'}</span>
          </button>

          <button type="button"
            className="btn btn-secondary btn-large"
            onClick={handleExport}
            disabled={exportLoading || isRejected || hasBlockingErrors}
          >
            {exportLoading ? (
              <>
                <span className="spinner"></span>
                <span>正在回寫資料並重建活頁簿...</span>
              </>
            ) : (
              <>
                <svg className="download-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '20px', height: '20px', marginRight: '8px' }} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>匯出並下載 Excel 文件</span>
              </>
            )}
          </button>
        </div>
        {hasBlockingErrors && (
          <div style={{ color: '#ef4444', fontSize: '0.88rem', textAlign: 'center' }}>
            ⚠️ 尚有 {blockingErrorsCount} 項必填防呆未完成，完成後方可匯出 Excel 與列印報表。
          </div>
        )}
      </div>

      {exportError && (
        <div role="alert" style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '14px', textAlign: 'center' }}>
          ⚠️ {exportError}
        </div>
      )}
      {printError && (
        <div role="alert" style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '14px', textAlign: 'center' }}>
          ⚠️ {printError}
        </div>
      )}

      {exportSuccess && (
        <div className="export-success-card glass-card animate-fade-in" role="status" style={{ marginTop: '20px', padding: '24px', border: '1px solid #10b981', borderRadius: '12px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)' }}>
          <span style={{ fontSize: '2rem', color: '#10b981', display: 'block', marginBottom: '8px' }}>✓</span>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 'var(--fs-title-3, 1.25rem)' }}>Excel 已匯出</h3>
          <p style={{ margin: '0 0 16px 0', color: 'var(--c-text-2, #64748b)' }}>簽核版文件已完成下載（{fileName}_對齊簽核版.xlsx）。</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => setExportSuccess(false)}>
              確定
            </button>
            <button type="button" className="btn btn-secondary" onClick={onFinalBackToList}>
              回到機種列表
            </button>
          </div>
        </div>
      )}

      {/* D-109: 簽核與審查退件歷程記錄時間軸 */}
      {Array.isArray(signOff.signOffHistory) && signOff.signOffHistory.length > 0 && (
        <div className="signoff-history-card" style={{ marginTop: '24px', padding: '16px', background: 'rgba(248, 250, 252, 0.9)', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 600, color: '#334155' }}>📋 簽核與審查歷程記錄</h3>
          <div className="history-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {signOff.signOffHistory.map((item, idx) => (
              <div key={idx} style={{ padding: '8px 12px', background: item.type === 'reject' ? '#fff1f2' : '#f0fdf4', borderLeft: `4px solid ${item.type === 'reject' ? '#e11d48' : '#16a34a'}`, borderRadius: '4px', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: item.type === 'reject' ? '#9f1239' : '#166534' }}>
                  <span>{item.type === 'reject' ? '⛔ 品保退件' : '↩️ 重新送審'} ({item.byUnit ? `${item.byUnit} · ` : ''}{item.by})</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{fmtDateTime(item.at)}</span>
                </div>
                <div style={{ marginTop: '4px', color: '#334155' }}>
                  {item.type === 'reject' ? `原因：${item.reason}` : `修正說明：${item.note}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

SignOff.propTypes = {
  data: PropTypes.object.isRequired,
  originalWb: PropTypes.object,
  fileName: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onExportComplete: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    username: PropTypes.string,
    unit: PropTypes.string,
    role: PropTypes.string,
    signature: PropTypes.string,
  }),
  onUpdateAccountSignature: PropTypes.func.isRequired,
  onFinalExit: PropTypes.func.isRequired,
  onFinalBackToList: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};






