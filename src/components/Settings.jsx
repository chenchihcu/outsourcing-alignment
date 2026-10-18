import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import './Settings.css';
import { compressImage } from '../utils/imageCompressor';
import { isSupabaseEnabled } from '../data/supabaseClient';
import { inviteUser, listAllProfiles, updateUserProfile } from '../data/auth';
import { generateSalt, hashPassword } from '../utils/cryptoAuth';

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
        帳號由管理員統一邀請。對方收到邀請郵件並設定密碼後即可登入；帳號無法自行申請。
      </p>

      {roleError && (
        <div role="alert" style={{ color: 'var(--c-error)', fontSize: 'var(--fs-base)', marginTop: '8px' }}>
          ⚠️ {roleError}
        </div>
      )}

      {/* 邀請表單 */}
      <form onSubmit={handleInvite} className="invite-user-form">
        <div className="form-group invite-input-email">
          <label className="form-label" htmlFor="inviteEmail">電子郵件 <span className="req">*</span></label>
          <input type="email" className="form-input edit-active" placeholder="name@company.com" id="inviteEmail"
            value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
        </div>
        <div className="form-group invite-input-name">
          <label className="form-label" htmlFor="inviteName">顯示名稱</label>
          <input type="text" className="form-input edit-active" placeholder="例：陳小明" id="inviteName"
            value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
        </div>
        <div className="form-group invite-input-role">
          <label className="form-label" htmlFor="inviteRole">單位 / 角色</label>
          <select className="form-input edit-active" value={inviteRoleIdx} id="inviteRole"
            onChange={(e) => setInviteRoleIdx(Number(e.target.value))}>
            {CLOUD_ROLE_OPTIONS.map((r, i) => (
              <option key={r.value} value={i}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="invite-form-actions">
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            {inviting ? '發送中…' : '📨 發送邀請'}
          </button>
        </div>
      </form>

      {msg && <p style={{ marginTop: '10px', fontSize: 'var(--fs-base)', color: msg.startsWith('✅') ? 'var(--c-success)' : 'var(--c-error)' }}>{msg}</p>}

      {/* 使用者清單 */}
      <h4 style={{ marginTop: '24px', marginBottom: '8px' }}>現有使用者（{profiles.length}）</h4>
      {loading ? (
        <p style={{ color: 'var(--c-text-3)', fontSize: 'var(--fs-base)' }}>載入中…</p>
      ) : (
        <div className="accounts-table-container">
          <table className="settings-table">
            <thead>
              <tr>
                <th scope="col">顯示名稱</th>
                <th scope="col">單位</th>
                <th scope="col">角色</th>
                <th scope="col">建立時間</th>
                <th scope="col">動作</th>
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
                  <td style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('zh-TW') : '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--c-text-3)' }}>
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
  accounts,
  onAddAccount,
  onRemoveAccount,
  onUpdateAccountLevel,
  onUpdateAccountSignature,
  currentUser
}) {
  const sigInputRef = useRef(null);
  const [newFactory, setNewFactory] = useState('');
  const [sigError, setSigError] = useState('');

  // 本機模式帳號表單 State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [newUnit, setNewUnit] = useState('研發單位');
  const [newLevel, setNewLevel] = useState('Standard');

  const handleAddFactorySubmit = (e) => {
    e.preventDefault();
    if (!newFactory.trim()) return;
    onAddFactory(newFactory.trim());
    setNewFactory('');
  };

  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const handleAddAccountSubmit = async (e) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');
    const trimUser = newUsername.trim();
    const trimPass = newPassword.trim();
    if (!trimUser || !trimPass) {
      setUserFormError('請填寫所有必要欄位！');
      return;
    }
    // U8 — 密碼長度與帳號格式驗證
    if (trimPass.length < 6) {
      setUserFormError('密碼至少需要 6 個字元。');
      return;
    }
    if (!/^[a-zA-Z0-9_@.-]+$/.test(trimUser)) {
      setUserFormError('帳號只能包含英數字、底線、@、點與連字符。');
      return;
    }
    // U8 — 大小寫不分的重複帳號檢查
    if (accounts.some(a => a.username.toLowerCase() === trimUser.toLowerCase())) {
      setUserFormError('該帳號已存在（帳號不區分大小寫）！');
      return;
    }

    const salt = generateSalt();
    const hash = await hashPassword(newPassword, salt);

    const newAcc = {
      username: newUsername.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      unit: newUnit,
      role: newUnit === '研發單位' ? 'rd' : newUnit === '工程單位' ? 'eng' : newUnit === '審核單位(品保處)' ? 'qa' : 'admin',
      level: newLevel
    };

    onAddAccount(newAcc);
    setNewUsername('');
    setNewPassword('');
    setUserFormSuccess('使用者帳號新增成功！');
  };

  const handleUnitChange = (val) => {
    setNewUnit(val);
  };

  return (
    <div className="settings-container animate-fade-in">
      <h2 className="section-title">⚙️ 系統資料與權限設定管理</h2>

      <div className="settings-grid">
        {/* 雲端模式：Admin 使用者管理（取代本機帳號管理） */}
        {isSupabaseEnabled && currentUser.role === 'admin' && (
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
              {currentUser.signature ? (
                <img src={currentUser.signature} alt="我的簽章" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-text-3)' }}>尚未設定電子簽章</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="file" 
                accept="image/png,image/jpeg" 
                ref={sigInputRef} 
                id="signature-upload-input"
                style={{ display: 'none' }} 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      try {
                        setSigError('');
                        const compressed = await compressImage(event.target.result);
                        onUpdateAccountSignature(currentUser.username, compressed);
                      } catch (err) {
                        setSigError(err.message);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => sigInputRef.current?.click()}
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
                    }}
                    style={{ background: 'var(--c-error-weak)', color: 'var(--c-error)', border: '1px solid var(--c-error-border)' }}
                  >
                    🗑️ 清除簽章
                  </button>
                )}
              </div>
              {sigError && (
                <div style={{ color: 'var(--c-error)', fontSize: 'var(--fs-base)', marginTop: '4px' }}>
                  ⚠️ {sigError}
                </div>
              )}
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--c-text-3)' }}>僅支援 JPG/PNG 格式，檔案大小建議小於 500KB</span>
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

        {/* 2. 帳號權限設定（僅本機離線模式顯示） */}
        {!isSupabaseEnabled && <div className="settings-section-card glass-card">
          <h3>👥 系統使用者與權限等級設定</h3>
          <p className="card-desc">管理各單位的使用者帳號、密碼及對應的填寫審核權限。</p>

          <div className="accounts-layout">
            {/* 新增帳號 */}
            <form onSubmit={handleAddAccountSubmit} className="add-account-form">
              <h4>新增帳號：</h4>
              <div className="form-row-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="newUsername">登入帳號 <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input edit-active"
                    placeholder="帳號"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="newPassword">密碼 <span className="req">*</span></label>
                  <input
                    type="password"
                    className="form-input edit-active"
                    placeholder="密碼"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row-grid" style={{ marginTop: '8px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="newLevel">權限等級</label>
                  <select
                    className="form-input edit-active"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                  >
                    <option value="Standard">Standard (一般編輯)</option>
                    <option value="Reviewer">Reviewer (審核權限)</option>
                    <option value="Administrator">Administrator (最高權限)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="newUnit">所屬單位</label>
                  <select
                    className="form-input edit-active"
                    value={newUnit}
                    onChange={(e) => handleUnitChange(e.target.value)}
                  >
                    <option value="研發單位">研發單位 (EVT / DVT 負責)</option>
                    <option value="工程單位">工程單位 (PVT / Pilot-run 負責)</option>
                    <option value="審核單位(品保處)">審核單位 (品保處 - 僅審核)</option>
                    <option value="管理處">管理處 (Admin 級別)</option>
                  </select>
                </div>
              </div>

              {userFormError && (
                <div role="alert" style={{ color: 'var(--c-error)', fontSize: 'var(--fs-base)', marginTop: '8px' }}>
                  ⚠️ {userFormError}
                </div>
              )}
              {userFormSuccess && (
                <div role="status" style={{ color: 'var(--c-success)', fontSize: 'var(--fs-base)', marginTop: '8px' }}>
                  ✓ {userFormSuccess}
                </div>
              )}

              <button type="submit" className="btn btn-secondary btn-block" style={{ marginTop: '12px' }}>
                ➕ 新增使用者帳號
              </button>
            </form>

            <div className="accounts-list-wrapper">
              <h4>現有使用者帳號清單：</h4>
              <div className="accounts-table-container">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th scope="col">單位</th>
                      <th scope="col">帳號</th>
                      <th scope="col">密碼</th>
                      <th scope="col">權限</th>
                      <th scope="col">動作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => (
                      <tr key={acc.username} className={currentUser.username === acc.username ? 'current-user-row' : ''}>
                        <td>{acc.unit} {currentUser.username === acc.username && '(您)'}</td>
                        <td><code>{acc.username}</code></td>
                        <td>
                          <code>{revealedPasswords[acc.username] ? acc.password : '••••••'}</code>
                          <button
                            type="button"
                            className="btn-reveal-pw"
                            onClick={() => setRevealedPasswords(prev => ({ ...prev, [acc.username]: !prev[acc.username] }))}
                            title={revealedPasswords[acc.username] ? '隱藏密碼' : '顯示密碼'}
                            aria-label={revealedPasswords[acc.username] ? '隱藏密碼' : '顯示密碼'}
                          >
                            {revealedPasswords[acc.username] ? '🙈' : '👁'}
                          </button>
                        </td>
                        <td>
                          <select
                            className="table-select-level"
                            value={acc.level}
                            onChange={(e) => onUpdateAccountLevel(acc.username, e.target.value)}
                            disabled={currentUser.username === acc.username || acc.role === 'admin'}
                          >
                            <option value="Standard">Standard</option>
                            <option value="Reviewer">Reviewer</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        </td>
                        <td>
                          {confirmDeleteUser === acc.username ? (
                            <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-xs btn-confirm-delete-account"
                                onClick={() => {
                                  onRemoveAccount(acc.username);
                                  setConfirmDeleteUser(null);
                                }}
                              >
                                確認刪除
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => setConfirmDeleteUser(null)}
                              >
                                取消
                              </button>
                            </span>
                          ) : (
                            <button type="button"
                              className="btn-delete-account"
                              disabled={currentUser.username === acc.username || acc.role === 'admin'}
                              onClick={() => {
                                setConfirmDeleteUser(acc.username);
                              }}
                              title={
                                currentUser.username === acc.username
                                  ? '無法刪除目前登入的帳號'
                                  : acc.role === 'admin'
                                  ? '系統管理員帳號無法刪除'
                                  : '刪除此帳號'
                              }
                            >
                              刪除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

Settings.propTypes = {
  factories: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddFactory: PropTypes.func.isRequired,
  onRemoveFactory: PropTypes.func.isRequired,
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string.isRequired,
      password: PropTypes.string.isRequired,
      unit: PropTypes.string,
      role: PropTypes.string,
      level: PropTypes.string,
      signature: PropTypes.string,
    })
  ).isRequired,
  onAddAccount: PropTypes.func.isRequired,
  onRemoveAccount: PropTypes.func.isRequired,
  onUpdateAccountLevel: PropTypes.func.isRequired,
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








