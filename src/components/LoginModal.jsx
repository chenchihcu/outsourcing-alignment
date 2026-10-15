import { useState } from 'react';
import PropTypes from 'prop-types';
import './LoginModal.css';
import { isSupabaseEnabled } from '../data/supabaseClient';
import { signIn } from '../data/auth';

export default function LoginModal({ onLogin, accounts = [], onCreateAdmin, onResetAccounts }) {
  const isFirstLaunch = !isSupabaseEnabled && (!accounts || accounts.length === 0);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unit, setUnit] = useState('管理處');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tryLocalLogin = (uname, pw) => {
    const list = accounts || [];
    const account = list.find((a) => a.username === uname && a.password === pw);
    if (account) { onLogin(account); setError(''); return true; }
    return false;
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setError('');

    const uname = username.trim();
    const pw = password.trim();
    const cpw = confirmPassword.trim();

    if (!uname || !pw) {
      setError('請輸入管理員帳號與密碼。');
      return;
    }
    if (pw !== cpw) {
      setError('兩次輸入的密碼不一致，請重新確認。');
      return;
    }

    const adminUser = {
      username: uname,
      password: pw,
      unit: unit.trim() || '管理處',
      role: 'admin',
      level: 'Administrator',
    };

    if (onCreateAdmin) {
      onCreateAdmin(adminUser);
    } else {
      onLogin(adminUser);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 雲端模式：僅允許經由 Supabase Auth 驗證，絕不比對本機快取帳號 (D-01)
    if (isSupabaseEnabled) {
      setBusy(true);
      try {
        const user = await signIn(username, password);
        if (user) onLogin(user);
        else setError('登入失敗，請確認帳號與密碼。');
      } catch (err) {
        const msg = err?.message || '';
        if (msg.includes('Invalid login credentials')) {
          setError('帳號或密碼錯誤，請重新確認。');
        } else if (msg.includes('Email not confirmed')) {
          setError('該帳號信箱尚未完成驗證，請至信箱收取確認信。');
        } else if (msg.includes('User not found')) {
          setError('此帳號不存在，請聯絡系統管理員開通。');
        } else {
          setError(msg || '操作失敗，請稍後再試。');
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    // 離線模式：比對本機已建立之帳號
    if (tryLocalLogin(username, password)) return;
    setError('帳號或密碼錯誤！');
  };

  return (
    <div className="login-overlay">
      <div className="login-card glass-card animate-fade-in">
        <div className="login-header">
          <span className="login-logo-icon">{isFirstLaunch ? '🚀' : '🔐'}</span>
          <h2>{isFirstLaunch ? '建立本機管理員' : '系統登入 / 權限驗證'}</h2>
          <p>
            {isFirstLaunch
              ? '系統首次啟動，請先設定第一組本機管理員帳號以開始使用。'
              : '醫電鼎眾 Mitcorp | 產品委外加工資訊系統'}
          </p>
          <div className="login-mode-tag">
            {isSupabaseEnabled ? '☁ 雲端帳號(跨裝置同步)' : isFirstLaunch ? '🛠️ 首次設定(離線模式)' : '💾 本機模式(離線)'}
          </div>
        </div>

        {isFirstLaunch ? (
          <form onSubmit={handleCreateSubmit} className="login-form">
            {error && <div className="login-error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="admin-username-input">管理員帳號</label>
              <input
                id="admin-username-input"
                type="text"
                className="form-input edit-active"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如 admin"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-unit-input">所屬單位</label>
              <input
                id="admin-unit-input"
                type="text"
                className="form-input edit-active"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="管理處"
                name="unit"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-password-input">密碼</label>
              <input
                id="admin-password-input"
                type="password"
                className="form-input edit-active"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請設定密碼"
                name="password"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-confirm-password-input">確認密碼</label>
              <input
                id="admin-confirm-password-input"
                type="password"
                className="form-input edit-active"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="請再次輸入密碼"
                name="confirmPassword"
                autoComplete="new-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '16px' }}>
              建立管理員並登入
            </button>
            <p style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', marginTop: '12px' }}>
              💡 帳號密碼將安全儲存於您目前的本機瀏覽器中，登入後可於「系統設定」建立其他單位之帳號。
            </p>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="login-form">
            {error && <div className="login-error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="username-input">帳號</label>
              <input
                id="username-input"
                type="text"
                className="form-input edit-active"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="請輸入帳號"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">密碼</label>
              <input
                id="password-input"
                type="password"
                className="form-input edit-active"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                name="password"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '16px' }} disabled={busy}>
              {busy ? '驗證中…' : '確認登入'}
            </button>

            {isSupabaseEnabled ? (
              <p className="login-contact-hint">
                尚無 Supabase 帳號？請聯絡系統管理員開通。
              </p>
            ) : (
              <>
                {onResetAccounts && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn-link"
                      style={{ fontSize: '0.82rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => {
                        if (window.confirm('確定要清除本機登入帳號並重新設定管理員嗎？\n（此操作不會刪除已儲存的機種表單資料）')) {
                          onResetAccounts();
                          setError('');
                        }
                      }}
                    >
                      忘記密碼？重設本機管理員
                    </button>
                  </div>
                )}
                <p className="login-contact-hint" style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
                  提示：目前為本機離線模式。若需啟用雲端多端同步，請於專案目錄設定 .env 金鑰。
                </p>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

LoginModal.propTypes = {
  onLogin: PropTypes.func.isRequired,
  onCreateAdmin: PropTypes.func,
  onResetAccounts: PropTypes.func,
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string.isRequired,
      password: PropTypes.string,
      unit: PropTypes.string,
      role: PropTypes.string,
      level: PropTypes.string,
    })
  ),
};
