import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { navigateTo, parseHash } from '../utils/hashRouter.js';
import * as XLSX from 'xlsx';

export default function ProjectNew({ projects = [], onCreateProject, onImportExcel, currentUser }) {
  const current = parseHash();
  const initialMode = current.query?.mode === 'import' ? 'import' : 'template';
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);

  // D-154 / OD-05: QA 角色嚴禁建立機種
  if (currentUser?.role === 'qa') {
    return (
      <div className="create-project-page project-new-container" style={{ padding: '32px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="banner-error" role="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', padding: '24px', borderRadius: '12px' }}>
          <h2 style={{ fontSize: 'var(--fs-title-3)', color: '#ef4444', marginBottom: '8px' }}>權限不足</h2>
          <p style={{ color: 'var(--c-text-1, #1e293b)', fontSize: 'var(--fs-md)', marginBottom: '20px' }}>
            審核單位（品保處）為覆核角色，不能建立或匯入新機種。
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigateTo('/projects')}>
            返回機種清單
          </button>
        </div>
      </div>
    );
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('請輸入機種名稱！');
      return;
    }

    // 重複名稱檢查 (B13, F3-3)
    if (projects.some(p => (p.name || p.fileName || '').trim().toLowerCase() === trimmed.toLowerCase())) {
      setError('該機種名稱已存在，請使用不同名稱！');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateProject(trimmed);
    } catch (err) {
      setError(err?.message || '建立失敗');
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!file.name.endsWith('.xlsx')) {
      setError('僅支援 .xlsx 格式檔案！');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetNames = wb.SheetNames;
        const requiredSheets = ['產品基本資料', '製程管制與前置作業', '試產報告要求'];
        const missing = requiredSheets.filter(s => !sheetNames.includes(s));
        if (missing.length > 0) {
          setError(`缺少必要工作表：${missing.join('、')}`);
          return;
        }

        const defaultName = file.name.replace(/\.xlsx$/i, '');
        setName(defaultName);
        setImportPreview({
          fileName: file.name,
          defaultName,
          wb,
          arrayBuffer: event.target.result,
        });
      } catch {
        setError('解析 Excel 檔案失敗，請確認檔案格式是否正確。');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const finalName = name.trim() || importPreview.defaultName;
    if (projects.some(p => (p.name || p.fileName || '').trim().toLowerCase() === finalName.toLowerCase())) {
      setError('該機種名稱已存在，請使用不同名稱！');
      return;
    }

    setIsSubmitting(true);
    try {
      await onImportExcel(importPreview.arrayBuffer, finalName);
    } catch (err) {
      setError(err?.message || '匯入失敗');
      setIsSubmitting(false);
    }
  };

  const handleCancelOrBack = () => {
    const isDirty = Boolean(name.trim() || importPreview);
    if (isDirty) {
      if (!window.confirm('您有未儲存的建立內容，確定要放棄並返回嗎？')) {
        return;
      }
    }
    navigateTo('/projects');
  };

  return (
    <div className="create-project-page project-new-container animate-fade-in" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelOrBack}>
          ← 返回清單
        </button>
      </div>

      <div className="glass-card" style={{ padding: '28px', borderRadius: '12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h1 style={{ fontSize: 'var(--fs-title-3, 0.84375rem)', fontWeight: 700, marginBottom: '8px' }}>
          ➕ 建立新機種
        </h1>
        <p style={{ color: 'var(--c-text-2)', fontSize: 'var(--fs-md)', marginBottom: '24px' }}>
          您可以從標準空白範本建立全新機種，或是匯入現有的 Excel 需求表進行對齊與簽核。
        </p>

        {/* 分段控制 (Apple HIG Segmented Control) */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--c-surface-2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              flex: 1,
              height: '44px',
              borderRadius: '8px',
              border: mode === 'template' ? '1px solid var(--c-border)' : 'none',
              background: mode === 'template' ? 'var(--c-surface)' : 'transparent',
              color: mode === 'template' ? 'var(--c-text-1)' : 'var(--c-text-2)',
              fontWeight: mode === 'template' ? 650 : 500,
              boxShadow: mode === 'template' ? 'var(--sh-1)' : 'none',
              transition: 'all 0.18s ease',
            }}
            onClick={() => { setMode('template'); setError(''); }}
          >
            📋 從空白範本建立
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              flex: 1,
              height: '44px',
              borderRadius: '8px',
              border: mode === 'import' ? '1px solid var(--c-border)' : 'none',
              background: mode === 'import' ? 'var(--c-surface)' : 'transparent',
              color: mode === 'import' ? 'var(--c-text-1)' : 'var(--c-text-2)',
              fontWeight: mode === 'import' ? 650 : 500,
              boxShadow: mode === 'import' ? 'var(--sh-1)' : 'none',
              transition: 'all 0.18s ease',
            }}
            onClick={() => { setMode('import'); setError(''); }}
          >
            📥 匯入 Excel 機種
          </button>
        </div>

        {error && (
          <div role="alert" className="field-error banner-error" style={{ color: 'var(--c-error)', background: 'var(--c-error-weak)', border: '1px solid var(--c-error-border)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: 'var(--fs-md)' }}>
            ⚠️ {error}
          </div>
        )}

        {mode === 'template' ? (
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="projectName" className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', color: 'var(--c-text-1)' }}>
                機種名稱 <span style={{ color: 'var(--c-error)' }}>*</span>
              </label>
              <input
                id="projectName"
                type="text"
                className="form-input edit-active"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="例如：PROJECT_ALTAIR_2026"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  fontSize: 'var(--fs-callout)',
                  borderRadius: '10px',
                  border: '1.5px solid var(--c-border)',
                  background: 'var(--c-surface)',
                  color: 'var(--c-text-1)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 24px',
                  fontSize: 'var(--fs-callout)',
                  fontWeight: 600,
                  boxShadow: 'var(--sh-1)',
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? '建立中…' : '建立機種'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text-2)',
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 20px',
                  fontSize: 'var(--fs-callout)',
                }}
                onClick={handleCancelOrBack}
              >
                取消
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ border: '2px dashed var(--c-border-strong)', padding: '32px', textAlign: 'center', borderRadius: '8px', marginBottom: '20px' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <span style={{ fontSize: 'var(--fs-large-title)', display: 'block', marginBottom: '12px' }}>📂</span>
              <p style={{ marginBottom: '16px', color: 'var(--c-text-2)' }}>
                請點擊選擇本公司範本格式之新機種委外加工需求一覽表 (.xlsx)
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                選擇 .xlsx 檔案
              </button>
            </div>

            {importPreview && (
              <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--c-surface-2)', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
                <h3 style={{ fontSize: 'var(--fs-callout)', fontWeight: 600, marginBottom: '12px' }}>檔案預覽確認</h3>
                <div className="form-group">
                  <label htmlFor="importProjectName" className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
                    匯入後機種名稱：
                  </label>
                  <input
                    id="importProjectName"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 24px',
                  fontSize: 'var(--fs-callout)',
                  fontWeight: 600,
                  boxShadow: 'var(--sh-1)',
                }}
                disabled={!importPreview || isSubmitting}
                onClick={handleConfirmImport}
              >
                {isSubmitting ? '匯入中…' : '確認匯入'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text-2)',
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 20px',
                  fontSize: 'var(--fs-callout)',
                }}
                onClick={handleCancelOrBack}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ProjectNew.propTypes = {
  projects: PropTypes.array,
  onCreateProject: PropTypes.func.isRequired,
  onImportExcel: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
};
