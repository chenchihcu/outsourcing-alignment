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
          <h2 style={{ fontSize: '1.25rem', color: '#ef4444', marginBottom: '8px' }}>權限不足</h2>
          <p style={{ color: 'var(--c-text-1, #1e293b)', fontSize: '0.95rem', marginBottom: '20px' }}>
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

  return (
    <div className="create-project-page project-new-container animate-fade-in" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigateTo('/projects')}>
          ← 返回清單
        </button>
      </div>

      <div className="glass-card" style={{ padding: '28px', borderRadius: '12px', background: 'var(--c-surface, #ffffff)', border: '1px solid var(--c-border, #e2e8f0)' }}>
        <h1 style={{ fontSize: 'var(--fs-title-3, 1.25rem)', fontWeight: 700, marginBottom: '8px' }}>
          ➕ 建立新機種
        </h1>
        <p style={{ color: 'var(--c-text-2, #64748b)', fontSize: '0.9rem', marginBottom: '24px' }}>
          您可以從標準空白範本建立全新機種，或是匯入現有的 Excel 需求表進行對齊與簽核。
        </p>

        {/* 分段控制 (Apple HIG Segmented Control) */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--c-surface-2, #f1f5f9)', padding: '4px', borderRadius: '10px', border: '1px solid var(--c-border, #e2e8f0)' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              flex: 1,
              height: '40px',
              borderRadius: '8px',
              border: mode === 'template' ? '1px solid rgba(0,0,0,0.05)' : 'none',
              background: mode === 'template' ? '#ffffff' : 'transparent',
              color: mode === 'template' ? 'var(--c-text-1, #0f172a)' : 'var(--c-text-2, #64748b)',
              fontWeight: mode === 'template' ? 650 : 500,
              boxShadow: mode === 'template' ? '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)' : 'none',
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
              height: '40px',
              borderRadius: '8px',
              border: mode === 'import' ? '1px solid rgba(0,0,0,0.05)' : 'none',
              background: mode === 'import' ? '#ffffff' : 'transparent',
              color: mode === 'import' ? 'var(--c-text-1, #0f172a)' : 'var(--c-text-2, #64748b)',
              fontWeight: mode === 'import' ? 650 : 500,
              boxShadow: mode === 'import' ? '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)' : 'none',
              transition: 'all 0.18s ease',
            }}
            onClick={() => { setMode('import'); setError(''); }}
          >
            📥 匯入 Excel 機種
          </button>
        </div>

        {error && (
          <div role="alert" className="field-error banner-error" style={{ color: '#dc2626', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
            ⚠️ {error}
          </div>
        )}

        {mode === 'template' ? (
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="projectName" className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '8px', color: 'var(--c-text-1, #1e293b)' }}>
                機種名稱 <span style={{ color: '#dc2626' }}>*</span>
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
                  fontSize: '1rem',
                  borderRadius: '10px',
                  border: '1.5px solid var(--c-border, #e2e8f0)',
                  background: 'var(--c-surface, #ffffff)',
                  color: 'var(--c-text-1, #1e293b)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  background: 'var(--c-surface, #ffffff)',
                  border: '1px solid var(--c-border, #cbd5e1)',
                  color: 'var(--c-text-2, #475569)',
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 20px',
                  fontSize: '1rem',
                }}
                onClick={() => navigateTo('/projects')}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 24px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? '建立中…' : '建立機種'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ border: '2px dashed var(--c-border, #cbd5e1)', padding: '32px', textAlign: 'center', borderRadius: '8px', marginBottom: '20px' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📂</span>
              <p style={{ marginBottom: '16px', color: 'var(--c-text-2, #64748b)' }}>
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
              <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--c-surface-2, #f8fafc)', borderRadius: '8px', border: '1px solid var(--c-border, #e2e8f0)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>檔案預覽確認</h3>
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
                className="btn btn-secondary"
                style={{
                  background: 'var(--c-surface, #ffffff)',
                  border: '1px solid var(--c-border, #cbd5e1)',
                  color: 'var(--c-text-2, #475569)',
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 20px',
                  fontSize: '1rem',
                }}
                onClick={() => navigateTo('/projects')}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  borderRadius: '10px',
                  minHeight: '48px',
                  height: '48px',
                  padding: '0 24px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                }}
                disabled={!importPreview || isSubmitting}
                onClick={handleConfirmImport}
              >
                {isSubmitting ? '匯入中…' : '確認匯入'}
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
