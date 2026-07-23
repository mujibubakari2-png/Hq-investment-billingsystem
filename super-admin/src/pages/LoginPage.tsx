import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Lock, User, Zap, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-login-page">
      <div className="sa-login-bg" />

      <div className="sa-login-card">
        {/* Logo */}
        <div className="sa-login-logo">
          <div className="sa-login-logo-icon">
            <Zap size={26} color="white" />
          </div>
          <div>
            <div className="sa-login-title">Super Admin</div>
            <div className="sa-login-subtitle">HQ Investment Platform Control Center</div>
          </div>
        </div>

        {/* Restricted notice */}
        <div className="sa-login-restricted-notice">
          <ShieldAlert size={14} style={{ flexShrink: 0 }} />
          <span>Restricted access — Platform Administrators only</span>
        </div>

        {/* Error */}
        {error && (
          <div className="sa-login-error">
            <ShieldAlert size={14} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="sa-form-group">
            <label className="sa-label" htmlFor="sa-username">Username or Email</label>
            <div className="sa-input-group">
              <User className="sa-input-icon" size={15} />
              <input
                id="sa-username"
                className="sa-input"
                type="text"
                placeholder="admin@platform.com"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="sa-form-group" style={{ marginBottom: 20 }}>
            <label className="sa-label" htmlFor="sa-password">Password</label>
            <div className="sa-input-group">
              <Lock className="sa-input-icon" size={15} />
              <input
                id="sa-password"
                className="sa-input"
                type="password"
                placeholder="••••••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="sa-btn sa-btn-primary sa-btn-lg"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <span className="sa-spinner sa-spinner-sm" style={{ borderTopColor: 'white' }} />
            ) : (
              <Lock size={15} />
            )}
            {loading ? 'Authenticating…' : 'Sign in to Admin Portal'}
          </button>
        </form>

        <div className="sa-login-divider" />
        <p style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          This portal is for platform-level administration only.<br />
          Tenant admins should use the main application.
        </p>
      </div>
    </div>
  );
}
