import PropTypes from 'prop-types';
import { useState, useRef } from 'react';
import { compressImage } from '../utils/imageCompressor';

export default function AccountSettings({ currentUser, onUpdateAccountSignature }) {
  const fileInputRef = useRef(null);
  const [sigError, setSigError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
};
