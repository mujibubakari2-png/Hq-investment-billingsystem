import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LockIcon from '@mui/icons-material/Lock';
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

            navigate('/', { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg" />
            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">HQ</div>
                    <div>
                        <div className="login-logo-title">HQ INVESTMENT</div>
                        <div className="login-logo-sub">ISP Billing System</div>
                    </div>
                </div>

                <h2 className="login-heading">Welcome Back</h2>
                <p className="login-subheading">Sign in to your account to continue</p>

                {error && (
                    <div style={{
                        background: '#fff0f0',
                        color: '#c0392b',
                        padding: '10px 14px',
                        borderRadius: 8,
                        marginBottom: 16,
                        fontSize: '0.88rem',
                        border: '1px solid #f5c6cb',
                    }}>
                        {error}
                    </div>
                )}

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label">Username or Email</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="admin or admin@company.com"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="password-field">
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <button type="button" className="password-refresh-btn" onClick={() => setShowPass(!showPass)}>
                                {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </button>
                        </div>
                    </di