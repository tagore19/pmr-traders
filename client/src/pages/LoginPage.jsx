import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';

export default function LoginPage() {
  const { login } = useAuth();
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
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🐔</div>
          <h1>PMR Traders</h1>
          <p>Farm Box Distribution System</p>
        </div>

        {/* 1-Tap Field Login for Mobile */}
        <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', fontWeight: 600 }}>
            ⚡ 1-Tap Fast Login:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.2rem', justifyContent: 'center', fontWeight: 700, minHeight: '40px' }}
              onClick={() => doLogin('Admin Owner', 'admin123')}
              disabled={loading}
            >
              👑 Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.2rem', justifyContent: 'center', fontWeight: 700, minHeight: '40px' }}
              onClick={() => doLogin('Suresh Supervisor', 'suresh123')}
              disabled={loading}
            >
              🚚 Suresh
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.2rem', justifyContent: 'center', fontWeight: 700, minHeight: '40px' }}
              onClick={() => doLogin('Sathish Supervisor', 'sathish123')}
              disabled={loading}
            >
              🚚 Sathish
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

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

          <button id="login-submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, minHeight: '46px', fontSize: '1rem', fontWeight: 700 }} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔐 Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
