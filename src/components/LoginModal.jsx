import { useState } from 'react';
import PropTypes from 'prop-types';
import './LoginModal.css';
import { isSupabaseEnabled } from '../data/supabaseClient';
import { signIn } from '../data/auth';

export default function LoginModal({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isSupabaseEnabled) {
      setError('尚未配置 Supabase 雲端環境變數 (VITE_SUPABASE_URL)。本系統為純雲端上線架構，請聯絡管理員設定。');
      return;
    }

    setBusy(true);
    try {
      const user = await signIn(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('登入失敗，請確認帳號與密碼。');
      }
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError('帳號或密碼錯誤，請重新確認。');
      } else if (msg.includes('Email not confirmed')) {
        setError('該帳號信箱尚未完成驗證，請至信箱收取確認信。');
      } else if (msg.includes('User not found')) {
        setError('此帳號不存在，請聯絡系統管理處開通。');
      } else {
        setError(msg || '連線或登入失敗，請稍後再試。');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card glass-card animate-fade-in">
        <div className="login-header">
          <span className="login-logo-icon">🔐</span>
          <h2>系統登入 / 權限驗證</h2>
          <p>醫電鼎眾 Mitcorp | 產品委外加工資訊系統</p>
          <div className="login-mode-tag">
            ☁ 雲端模式 (Cloudflare 邊緣託管 / 跨裝置同步)
          </div>
        </div>

        {!isSupabaseEnabled ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div className="login-error-msg" style={{ marginBottom: '16px' }}>
              ⚠️ 未偵測到雲端服務設定
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
              本系統架構於 Cloudflare 與 Supabase，所有機種皆為線上即時協作。<br />
              請在環境設定檔 (.env 或 Cloudflare 環境變數) 中配置 <code>VITE_SUPABASE_URL</code> 與 <code>VITE_SUPABASE_ANON_KEY</code>。
            </p>
          </div>
        ) : (
          <form onSubmit={handleLoginSubmit} className="login-form">
            {error && <div className="login-error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="username-input">帳號或 Email</label>
              <input
                id="username-input"
                type="text"
                className="form-input edit-active"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如 admin 或完整 Email"
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
              {busy ? '登入驗證中…' : '確認登入'}
            </button>

            <p className="login-contact-hint" style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', marginTop: '14px' }}>
              提示：支援手機與跨裝置連線。輸入工號（如 <code>admin</code>）系統將自動補齊內部網域；需開通帳號請聯絡系統管理處。
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

LoginModal.propTypes = {
  onLogin: PropTypes.func.isRequired,
};
