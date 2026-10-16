import { useState } from 'react';
import PropTypes from 'prop-types';
import './LoginModal.css';
import { isSupabaseEnabled } from '../data/supabaseClient';
import { signIn } from '../data/auth';

import { verifyAccountPassword, sanitizeUserForSession } from '../utils/cryptoAuth';

export default function LoginModal({ onLogin, accounts = [] }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tryLocalLogin = async (uname, pw) => {
    const list = accounts || [];
    const normalizedUname = String(uname || '').trim().toLowerCase();
    const account = list.find((a) => String(a.username || '').trim().toLowerCase() === normalizedUname);
    
    if (account) {
      const isMatch = await verifyAccountPassword(pw, account);
      if (isMatch) {
        onLogin(sanitizeUserForSession(account));
        setError('');
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setError('請輸入帳號');
      return;
    }
    if (!password) {
      setError('請輸入密碼');
      return;
    }

    // 雲端模式：僅允許經由 Supabase Auth 驗證，絕不比對本機快取帳號 (D-01)
    if (isSupabaseEnabled) {
      setBusy(true);
      try {
        const user = await signIn(trimmedUser, password);
        if (user) onLogin(sanitizeUserForSession(user));
        else setError('登入失敗，請確認帳號與密碼。');
      } catch (err) {
        setError(err?.message || '操作失敗，請稍後再試。');
      } finally {
        setBusy(false);
      }
      return;
    }

    // 離線模式：比對本機已建立之帳號 (D-02, D-135)
    setBusy(true);
    try {
      const ok = await tryLocalLogin(trimmedUser, password);
      if (!ok) setError('帳號或密碼錯誤！');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card glass-card animate-fade-in">
        <div className="login-header">
          <span className="login-logo-icon">🔐</span>
          <h2>系統登入 / 權限驗證</h2>
          <p>醫電鼎眾 Mitcorp | 產品委外加工資訊系統</p>
          <div className="login-mode-tag">
            ☁ 雲端模式 (Cloudflare 邊緣託管 / 跨裝置同步)
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="login-form">
          {error && <div className="login-error-banner login-error-msg" role="alert">{error}</div>}

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

          {isSupabaseEnabled && (
            <p className="login-contact-hint">
              尚無 Supabase 帳號？請聯絡系統管理員開通。
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

LoginModal.propTypes = {
  onLogin: PropTypes.func.isRequired,
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
