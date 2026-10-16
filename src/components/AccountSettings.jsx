import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';
import { compressImage } from '../utils/imageCompressor';
import { getJSON, setJSON } from '../utils/storage';

export default function AccountSettings({ currentUser, onUpdateAccountSignature, onLogout }) {
  const fileInputRef = useRef(null);
  const [sigError, setSigError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const savedPrefs = getJSON('projectListPrefs', {});
  const [fontSize, setFontSize] = useState(savedPrefs.fontSize || 'medium');
  const [rowSpacing, setRowSpacing] = useState(savedPrefs.rowSpacing || 'normal');

  useEffect(() => {
    setJSON('projectListPrefs', { fontSize, rowSpacing });
  }, [fontSize, rowSpacing]);

  if (!currentUser) return null;

  return (
    <div className="account-settings-container animate-fade-in" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--c-text-1, #0f172a)', marginBottom: '8px' }}>
        👤 個人帳號與電子簽章設定
      </h2>
      <p style={{ color: 'var(--c-text-2, #64748b)', fontSize: '0.9rem', marginBottom: '24px' }}>
        在此管理您的帳號資訊與預設電子簽章，設定後在各機種簽核時可一鍵快速套用。
      </p>

      {/* 帳號資訊卡片 */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border, #e2e8f0)', marginBottom: '24px', background: 'var(--c-bg-card, #ffffff)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>基本資料</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>使用者名稱</span>
            <strong style={{ fontSize: '1rem' }}>{currentUser.username || currentUser.name || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>所屬單位</span>
            <strong style={{ fontSize: '1rem' }}>{currentUser.unit || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>權限角色</span>
            <strong style={{ fontSize: '1rem' }}>{currentUser.role?.toUpperCase() || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>權限等級</span>
            <strong style={{ fontSize: '1rem' }}>{currentUser.level || 'Standard'}</strong>
          </div>
        </div>
      </div>

      {/* 電子簽章卡片 */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border, #e2e8f0)', background: 'var(--c-bg-card, #ffffff)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>🖋️ 個人電子簽章</h3>
        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>
          上傳您的個人簽名圖檔（建議為透明背景之 PNG，比例約 3:1）。上傳時系統會自動進行去背二值化並優化儲存大小。
        </p>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div 
            style={{ 
              width: '240px', 
              height: '96px', 
              border: '2px dashed #cbd5e1', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: '#f8fafc',
              overflow: 'hidden'
            }}
          >
            {currentUser.signature ? (
              <img src={currentUser.signature} alt="我的簽章預覽" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>尚未設定電子簽章</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="file" 
              accept="image/png,image/jpeg" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) {
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    try {
                      setSigError('');
                      setSuccessMsg('');
                      const compressed = await compressImage(event.target.result);
                      onUpdateAccountSignature(currentUser.username, compressed);
                      setSuccessMsg('簽章上傳成功！');
                    } catch (err) {
                      setSigError(err.message);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                📤 上傳簽章圖檔
              </button>
              {currentUser.signature && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setSigError('');
                    onUpdateAccountSignature(currentUser.username, '');
                    setSuccessMsg('簽章已清除。');
                  }}
                  style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}
                >
                  🗑️ 清除簽章
                </button>
              )}
            </div>

            {sigError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                ⚠️ {sigError}
              </div>
            )}
            {successMsg && (
              <div style={{ color: '#16a34a', fontSize: '0.85rem' }}>
                ✓ {successMsg}
              </div>
            )}
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>僅支援 PNG / JPG 格式，原始檔案上限 5MB</span>
          </div>
        </div>
      </div>

      {/* 顯示設定卡片 */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border, #e2e8f0)', marginTop: '24px', background: 'var(--c-bg-card, #ffffff)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>🖥️ 機種列表顯示設定</h3>
        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>
          自訂機種列表與一覽表之字體大小與表格間距偏好，設定將自動儲存於本機。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--c-text-1)' }}>字體大小</span>
            <div className="btn-toggle-group" style={{ display: 'inline-flex', padding: '3px', background: 'var(--c-surface-2, #f1f5f9)', borderRadius: '8px', gap: '4px' }}>
              <button 
                type="button" 
                className={`toggle-btn ${fontSize === 'small' ? 'active' : ''}`}
                onClick={() => setFontSize('small')}
                style={{ minHeight: '36px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: fontSize === 'small' ? 'var(--c-surface, #fff)' : 'transparent', fontWeight: fontSize === 'small' ? 600 : 400, boxShadow: fontSize === 'small' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
              >
                小 (12px)
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${fontSize === 'medium' ? 'active' : ''}`}
                onClick={() => setFontSize('medium')}
                style={{ minHeight: '36px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: fontSize === 'medium' ? 'var(--c-surface, #fff)' : 'transparent', fontWeight: fontSize === 'medium' ? 600 : 400, boxShadow: fontSize === 'medium' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
              >
                中 (14px)
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
                style={{ minHeight: '36px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: fontSize === 'large' ? 'var(--c-surface, #fff)' : 'transparent', fontWeight: fontSize === 'large' ? 600 : 400, boxShadow: fontSize === 'large' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
              >
                大 (16px)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--c-text-1)' }}>表格間距</span>
            <div className="btn-toggle-group" style={{ display: 'inline-flex', padding: '3px', background: 'var(--c-surface-2, #f1f5f9)', borderRadius: '8px', gap: '4px' }}>
              <button 
                type="button" 
                className={`toggle-btn ${rowSpacing === 'compact' ? 'active' : ''}`}
                onClick={() => setRowSpacing('compact')}
                style={{ minHeight: '36px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: rowSpacing === 'compact' ? 'var(--c-surface, #fff)' : 'transparent', fontWeight: rowSpacing === 'compact' ? 600 : 400, boxShadow: rowSpacing === 'compact' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
              >
                緊湊
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${rowSpacing === 'normal' ? 'active' : ''}`}
                onClick={() => setRowSpacing('normal')}
                style={{ minHeight: '36px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: rowSpacing === 'normal' ? 'var(--c-surface, #fff)' : 'transparent', fontWeight: rowSpacing === 'normal' ? 600 : 400, boxShadow: rowSpacing === 'normal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
              >
                標準
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${rowSpacing === 'relaxed' ? 'active' : ''}`}
                onClick={() => setRowSpacing('relaxed')}
                style={{ minHeight: '36px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: rowSpacing === 'relaxed' ? 'var(--c-surface, #fff)' : 'transparent', fontWeight: rowSpacing === 'relaxed' ? 600 : 400, boxShadow: rowSpacing === 'relaxed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
              >
                寬鬆
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 登出系統動作區 */}
      {onLogout && (
        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary user-logout"
            onClick={onLogout}
            style={{ minHeight: '48px', width: '100%', maxWidth: '320px', color: 'var(--c-error)', borderColor: 'var(--c-border)', fontWeight: 600, fontSize: '15px' }}
          >
            登出系統
          </button>
        </div>
      )}
    </div>
  );
}

AccountSettings.propTypes = {
  currentUser: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    name: PropTypes.string,
    unit: PropTypes.string,
    role: PropTypes.string,
    level: PropTypes.string,
    signature: PropTypes.string,
  }),
  onUpdateAccountSignature: PropTypes.func.isRequired,
  onLogout: PropTypes.func,
};
