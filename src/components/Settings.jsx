import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import './Settings.css';
import { compressImage } from '../utils/imageCompressor';
import { inviteUser, listAllProfiles, updateUserProfile } from '../data/auth';

const CLOUD_ROLE_OPTIONS = [
  { value: 'rd',    label: '研發單位',             unit: '研發單位',             level: 'Engineer' },
  { value: 'eng',   label: '工程單位',             unit: '工程單位',             level: 'Engineer' },
  { value: 'qa',    label: '審核單位（品保處）',     unit: '審核單位（品保處）',     level: 'Reviewer' },
  { value: 'admin', label: '管理處（系統管理員）',   unit: '管理處',               level: 'Administrator' },
];

function CloudUserManagement({ currentUser }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRoleIdx, setInviteRoleIdx] = useState(0);
  const [inviting, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const reload = () => {
    setLoading(true);
    listAllProfiles()
      .then(setProfiles)
      .catch((e) => setMsg('載入失敗：' + e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true); setMsg('');
    const r = CLOUD_ROLE_OPTIONS[inviteRoleIdx];
    try {
      await inviteUser({ email: inviteEmail.trim(), username: inviteName.trim() || inviteEmail.split('@')[0], unit: r.unit, role: r.value, level: r.level });
      setMsg(`✅ 邀請郵件已送出至 ${inviteEmail}，對方確認信箱後即可登入。`);
      setInviteEmail(''); setInviteName(''); setInviteRoleIdx(0);
      reload();
    } catch (err) {
      setMsg('❌ 邀請失敗：' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const [roleError, setRoleError] = useState('');

  const handleRoleChange = async (userId, newRole) => {
    // U6 — 僅 admin 可修改角色
    if (currentUser.role !== 'admin') { setRoleError('無權限修改使用者角色。'); return; }
    const r = CLOUD_ROLE_OPTIONS.find((o) => o.value === newRole);
    if (!r) return;
    try {
      setRoleError('');
      await updateUserProfile(userId, { role: r.value, unit: r.unit, level: r.level });
      setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, role: r.value, unit: r.unit, level: r.level } : p));
    } catch (err) {
      setRoleError('角色更新失敗：' + err.message);
    }
  };

  return (
    <div className="settings-section-card glass-card" style={{ gridColumn: '1 / -1' }}>
      <h3>☁️ 雲端使用者管理（邀請制）</h3>
      <p className="card-desc">
        本系統為純雲端上線架構。使用者帳號由系統管理處統一開通邀請；受邀者可於手機或任何裝置完成驗證並登入。
      </p>

      {roleError && (
        <div role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px' }}>
          ⚠️ {roleError}
        </div>
      )}

      {/* 邀請表單 */}
      <form onSubmit={handleInvite} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginTop: '16px' }}>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label className="form-label" htmlFor="inviteEmail">電子郵件 <span className="req">*</span></label>
          <input type="email" className="form-input edit-active" placeholder="name@company.com" id="inviteEmail"
            value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
        </div>
        <div className="form-group" style={{ flex: '1 1 160px' }}>
          <label className="form-label" htmlFor="inviteName">顯示名稱</label>
          <input type="text" className="form-input edit-active" placeholder="例：陳小明" id="inviteName"
            value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label className="form-label" htmlFor="inviteRole">單位 / 角色</label>
          <select className="form-input edit-active" value={inviteRoleIdx} id="inviteRole"
            onChange={(e) => setInviteRoleIdx(Number(e.target.value))}>
            {CLOUD_ROLE_OPTIONS.map((r, i) => (
              <option key={r.value} value={i}>{r.label}</option>
            ))}
          </select>
        </div>
        <div style={{ paddingBottom: '2px' }}>
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            {inviting ? '發送中…' : '📨 發送邀請'}
          </button>
        </div>
      </form>

      {msg && <p style={{ marginTop: '10px', fontSize: '0.85rem', color: msg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{msg}</p>}

      {/* 使用者清單 */}
      <h4 style={{ marginTop: '24px', marginBottom: '8px' }}>現有雲端使用者（{profiles.length}）</h4>
      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>載入中…</p>
      ) : (
        <div className="accounts-table-container">
          <table className="settings-table">
            <thead>
              <tr>
                <th>顯示名稱</th>
                <th>單位</th>
                <th>角色</th>
                <th>建立時間</th>
                <th>動作</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className={currentUser.id === p.id ? 'current-user-row' : ''}>
                  <td>{p.username}{currentUser.id === p.id && ' (您)'}</td>
                  <td>{p.unit || '—'}</td>
                  <td>
                    <select
                      className="table-select-level"
                      value={p.role}
                      onChange={(e) => handleRoleChange(p.id, e.target.value)}
                      disabled={currentUser.id === p.id}
                      title={currentUser.id === p.id ? '無法修改自己的角色' : ''}
                    >
                      {CLOUD_ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('zh-TW') : '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {currentUser.id === p.id ? '（當前登入）' : '可於 Supabase Dashboard 停用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

CloudUserManagement.propTypes = {
  currentUser: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.string,
  }),
};

export default function Settings({
  factories,
  onAddFactory,
  onRemoveFactory,
  onUpdateAccountSignature,
  currentUser
}) {
  const [newFactory, setNewFactory] = useState('');

  const handleAddFactorySubmit = (e) => {
    e.preventDefault();
    if (!newFactory.trim()) return;
    onAddFactory(newFactory.trim());
    setNewFactory('');
  };

  return (
    <div className="settings-container animate-fade-in">
      <h2 className="section-title">⚙️ 系統資料與權限設定管理</h2>

      <div className="settings-grid">
        {/* 雲端模式：Admin 使用者管理 */}
        {currentUser?.role === 'admin' && (
          <CloudUserManagement currentUser={currentUser} />
        )}

        {/* 0. 個人電子簽章設定 */}
        <div className="settings-section-card glass-card" style={{ gridColumn: '1 / -1' }}>
          <h3>🖋️ 個人電子簽章設定</h3>
          <p className="card-desc">
            在此上傳您的個人電子簽章圖片（建議使用透明背景的 PNG 圖檔，比例約 3:1）。設定後，您在「簽章與匯出」進行線上簽名時，系統將直接以簽章圖檔作為簽核依據，使報告更顯正式與專業。
          </p>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
            <div 
              style={{ 
                width: '180px', 
                height: '70px', 
                border: '2px dashed rgba(255, 255, 255, 0.15)', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'rgba(0,0,0,0.2)',
                overflow: 'hidden'
              }}
            >
              {currentUser?.signature ? (
                <img src={currentUser.signature} alt="我的簽章" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>尚未設定電子簽章</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="file" 
                accept="image/*" 
                id="signature-upload-input" 
                style={{ display: 'none' }} 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ''; // 重設 input,讓同一張簽章圖可再次選取(如清除後重新上傳)
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const compressed = await compressImage(event.target.result);
                      onUpdateAccountSignature(currentUser.username, compressed);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => document.getElementById('signature-upload-input').click()}
                >
                  📤 上傳簽章圖檔
                </button>
                {currentUser?.signature && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => onUpdateAccountSignature(currentUser.username, '')}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                  >
                    🗑️ 清除簽章
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>僅支援 JPG/PNG 格式，檔案大小建議小於 500KB</span>
            </div>
          </div>
        </div>

        {/* 1. 委外加工廠基本資料管理 */}
        <div className="settings-section-card glass-card">
          <h3>🏭 委外加工廠基本資料管理</h3>
          <p className="card-desc">
            建立委外加工廠名稱後，可在「A. 產品基本資料」的選單中直接選擇，不需人工填寫。
          </p>

          <form onSubmit={handleAddFactorySubmit} className="settings-form-inline">
            <input
              type="text"
              className="form-input edit-active"
              placeholder="輸入新加工廠名稱 (例如: 鴻海)"
              value={newFactory}
              onChange={(e) => setNewFactory(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              新增
            </button>
          </form>

          <div className="factory-list-wrapper">
            {factories.length === 0 ? (
              <p className="no-data-text">目前無加工廠資料，請於上方新增。</p>
            ) : (
              <ul className="settings-list">
                {factories.map((fac, idx) => (
                  <li key={idx} className="settings-list-item">
                    <span>{fac}</span>
                    <button type="button"
                      className="btn-delete-item"
                      onClick={() => onRemoveFactory(fac)}
                      title="刪除此加工廠" aria-label="刪除加工廠"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

Settings.propTypes = {
  factories: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddFactory: PropTypes.func.isRequired,
  onRemoveFactory: PropTypes.func.isRequired,
  onUpdateAccountSignature: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    unit: PropTypes.string,
    role: PropTypes.string,
    level: PropTypes.string,
    signature: PropTypes.string,
  }),
};
