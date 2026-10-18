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
      <h2 style={{ fontSize: 'var(--fs-title-3, 0.84375rem)', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '8px' }}>
        👤 個人帳號與電子簽章設定
      </h2>
      <p style={{ color: 'var(--c-text-2)', fontSize: 'var(--fs-base)', marginBottom: '24px' }}>
        在此管理您的帳號資訊與預設電子簽章，設定後在各機種簽核時可一鍵快速套用。
      </p>

      {/* 帳號資訊卡片 */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border)', marginBottom: '24px', background: 'var(--c-surface)' }}>
        <h3 style={{ fontSize: 'var(--fs-title-3)', fontWeight: 600, marginBottom: '16px' }}>基本資料</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)', display: 'block' }}>使用者名稱</span>
            <strong style={{ fontSize: 'var(--fs-base)' }}>{currentUser.username || currentUser.name || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)', display: 'block' }}>所屬單位</span>
            <strong style={{ fontSize: 'var(--fs-base)' }}>{currentUser.unit || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)', display: 'block' }}>權限角色</span>
            <strong style={{ fontSize: 'var(--fs-base)' }}>{currentUser.role?.toUpperCase() || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)', display: 'block' }}>權限等級</span>
            <strong style={{ fontSize: 'var(--fs-base)' }}>{currentUser.level || 'Standard'}</strong>
          </div>
        </div>
      </div>

      {/* 電子簽章卡片 */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
        <h3 style={{ fontSize: 'var(--fs-title-3)', fontWeight: 600, marginBottom: '8px' }}>🖋️ 個人電子簽章</h3>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-2)', marginBottom: '16px' }}>
          上傳您的個人簽名圖檔（建議為透明背景之 PNG，比例約 3:1）。上傳時系統會自動進行去背二值化並優化儲存大小。
        </p>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div 
            style={{ 
              width: '240px', 
              height: '96px', 
              border: '2px dashed var(--c-border-strong)', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'var(--c-surface-2)',
              overflow: 'hidden'
            }}
          >
            {currentUser.signature ? (
              <img src={currentUser.signature} alt="我的簽章預覽" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)' }}>尚未設定電子簽章</span>
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
                  style={{ background: 'var(--c-error-weak)', color: 'var(--c-error)', border: '1px solid var(--c-error-border)' }}
                >
                  🗑️ 清除簽章
                </button>
              )}
            </div>

            {sigError && (
              <div style={{ color: 'var(--c-error)', fontSize: 'var(--fs-footnote)' }}>
                ⚠️ {sigError}
              </div>
            )}
            {successMsg && (
              <div style={{ color: 'var(--c-success)', fontSize: 'var(--fs-footnote)' }}>
                ✓ {successMsg}
              </div>
            )}
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--c-text-3)' }}>僅支援 PNG / JPG 格式，原始檔案上限 5MB</span>
          </div>
        </div>
      </div>

      {/* 顯示設定卡片 */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border)', marginTop: '24px', background: 'var(--c-surface)' }}>
        <h3 style={{ fontSize: 'var(--fs-title-3)', fontWeight: 600, marginBottom: '8px' }}>🖥️ 機種列表顯示設定</h3>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--c-text-2)', marginBottom: '16px' }}>
          自訂機種列表與一覽表之字體大小與表格間距偏好，設定將自動儲存於本機。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: 'var(--fs-subhead)', fontWeight: 600, color: 'var(--c-text-1)' }}>字體大小</span>
            <div className="btn-toggle-group" style={{ display: 'inline-flex', padding: '3px', background: 'var(--c-surface-2)', borderRadius: '8px', gap: '4px' }}>
              <button 
                type="button" 
                className={`toggle-btn ${fontSize === 'small' ? 'active' : ''}`}
                onClick={() => setFontSize('small')}
                style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: fontSize === 'small' ? 'var(--c-surface)' : 'transparent', color: fontSize === 'small' ? 'var(--c-text-1)' : 'var(--c-text-2)', fontWeight: fontSize === 'small' ? 600 : 400, boxShadow: fontSize === 'small' ? 'var(--sh-1)' : 'none', cursor: 'pointer' }}
              >
                小 (11px)
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${fontSize === 'medium' ? 'active' : ''}`}
                onClick={() => setFontSize('medium')}
                style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: fontSize === 'medium' ? 'var(--c-surface)' : 'transparent', color: fontSize === 'medium' ? 'var(--c-text-1)' : 'var(--c-text-2)', fontWeight: fontSize === 'medium' ? 600 : 400, boxShadow: fontSize === 'medium' ? 'var(--sh-1)' : 'none', cursor: 'pointer' }}
              >
                中 (13px)
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
                style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: fontSize === 'large' ? 'var(--c-surface)' : 'transparent', color: fontSize === 'large' ? 'var(--c-text-1)' : 'var(--c-text-2)', fontWeight: fontSize === 'large' ? 600 : 400, boxShadow: fontSize === 'large' ? 'var(--sh-1)' : 'none', cursor: 'pointer' }}
              >
                大 (14px)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: 'var(--fs-subhead)', fontWeight: 600, color: 'var(--c-text-1)' }}>表格間距</span>
            <div className="btn-toggle-group" style={{ display: 'inline-flex', padding: '3px', background: 'var(--c-surface-2)', borderRadius: '8px', gap: '4px' }}>
              <button 
                type="button" 
                className={`toggle-btn ${rowSpacing === 'compact' ? 'active' : ''}`}
                onClick={() => setRowSpacing('compact')}
                style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: rowSpacing === 'compact' ? 'var(--c-surface)' : 'transparent', color: rowSpacing === 'compact' ? 'var(--c-text-1)' : 'var(--c-text-2)', fontWeight: rowSpacing === 'compact' ? 600 : 400, boxShadow: rowSpacing === 'compact' ? 'var(--sh-1)' : 'none', cursor: 'pointer' }}
              >
                緊湊
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${rowSpacing === 'normal' ? 'active' : ''}`}
                onClick={() => setRowSpacing('normal')}
                style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: rowSpacing === 'normal' ? 'var(--c-surface)' : 'transparent', color: rowSpacing === 'normal' ? 'var(--c-text-1)' : 'var(--c-text-2)', fontWeight: rowSpacing === 'normal' ? 600 : 400, boxShadow: rowSpacing === 'normal' ? 'var(--sh-1)' : 'none', cursor: 'pointer' }}
              >
                標準
              </button>
              <button 
                type="button" 
                className={`toggle-btn ${rowSpacing === 'relaxed' ? 'active' : ''}`}
                onClick={() => setRowSpacing('relaxed')}
                style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: rowSpacing === 'relaxed' ? 'var(--c-surface)' : 'transparent', color: rowSpacing === 'relaxed' ? 'var(--c-text-1)' : 'var(--c-text-2)', fontWeight: rowSpacing === 'relaxed' ? 600 : 400, boxShadow: rowSpacing === 'relaxed' ? 'var(--sh-1)' : 'none', cursor: 'pointer' }}
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
            style={{ minHeight: '48px', width: '100%', maxWidth: '320px', color: 'var(--c-error)', borderColor: 'var(--c-border)', fontWeight: 600, fontSize: 'var(--fs-base)' }}
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
