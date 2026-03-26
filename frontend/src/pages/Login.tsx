import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { authApi } from '../api/client';
import authStore from '../stores/authStore';

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { token, user } = await authApi.login(username, password);
            authStore.login(token, user);

            if (remember) {
                localStorage.setItem('remember', 'true');
            }

            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f8', padding: '20px' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', width: '100%', maxWidth: '440px' }}>
                {/* Text Logo */}
                <div style={{ textAlign: 'center', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>

                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                            <span style={{ color: '#334155' }}>HQ</span> <span style={{ color: '#10b981' }}>INVESTMENT</span>
                        </h1>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 500, textTransform: 'uppercase' }}>
                        ISP Billing System
                    </div>
                </div>
                <h2 style={{ color: '#008ee6', fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', margin: '0 0 8px 0' }}>
                    Welcome back! ??
                </h2>
                <p style={{ color: '#64748b', textAlign: 'center', margin: '0 0 16px 0', fontSize: '1rem' }}>
                    Sign in to your account to continue
                </p>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <a href="/register" style={{ color: '#008ee6', textDecoration: 'none', fontWeight: 500, fontSize: '1rem' }}>
                        Create a new account
                    </a>
                </div>

                {error && (
                    <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontWeight: 500, fontSize: '0.95rem' }}>Email</label>
                        <input
                            type="text"
                            placeholder="Enter your email"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            onFocus={e => e.target.style.borderColor = '#008ee6'}
                            onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontWeight: 500, fontSize: '0.95rem' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                style={{ width: '100%', padding: '12px 16px', paddingRight: '48px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = '#008ee6'}
                                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#008ee6', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            >
                                {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', marginBottom: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: '#475569', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={e => setRemember(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#008ee6' }}
                            />
                            Remember me
                        </label>
                        <a href="/forgot-password" style={{ color: '#008ee6', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                            Forgot password?
                        </a>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', padding: '14px', backgroundColor: '#00a3ff', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', marginTop: '8px' }}
                        onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#008ee6')}
                        onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#00a3ff')}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    );
}
