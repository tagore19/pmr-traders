import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/api';

export default function LoginPage() {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function doLogin(username, pass) {
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.auth.login(username.trim(), pass.trim());
      login(user, token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await doLogin(form.name, form.password);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px 26px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative'
      }}>
        {/* Theme switcher on top right */}
        <button
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            cursor: 'pointer'
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        {/* Logo and App Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 12px',
            background: 'var(--primary)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 4px 16px var(--primary-glow)'
          }}>
            🐔
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.4px', margin: 0 }}>
            PMR Traders
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Poultry Trade & Farm Distribution
          </p>
        </div>

        {/* 1-Tap Field Login for Mobile */}
        <div style={{
          marginBottom: '20px',
          padding: '12px 14px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
            fontWeight: 700
          }}>
            ⚡ 1-Tap Quick Sign-In
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', fontWeight: 700, minHeight: '38px', justifyContent: 'center' }}
              onClick={() => doLogin('Admin Owner', 'admin123')}
              disabled={loading}
            >
              👑 Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', fontWeight: 700, minHeight: '38px', justifyContent: 'center' }}
              onClick={() => doLogin('Suresh Supervisor', 'suresh123')}
              disabled={loading}
            >
              🚚 Suresh
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', fontWeight: 700, minHeight: '38px', justifyContent: 'center' }}
              onClick={() => doLogin('Sathish Supervisor', 'sathish123')}
              disabled={loading}
            >
              🚚 Sathish
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              id="login-name"
              className="form-input"
              placeholder="e.g. admin, suresh, sathish"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button
            id="login-submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 14, minHeight: '48px', fontSize: '15px', fontWeight: 800 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : '🔐 Sign In to PMR System'}
          </button>
        </form>
      </div>
    </div>
  );
}
