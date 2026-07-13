import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import EmailIcon from '@mui/icons-material/Email';
import PasswordIcon from '@mui/icons-material/Password';
import LoginIcon from '@mui/icons-material/Login';
import { authApi, isMfaChallenge } from '../api/authApi';
import { isValidEmail } from '../utils/validators';
import authStore from '../stores/authStore';
import Footer from '../components/layout/Footer';
import { GoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const isGoogleConfigured = !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 20;

// ── Types ─────────────────────────────────────────────────────────────────────

type LoginStep = 'credentials' | 'mfa';

// ── Shared Styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    color: '#334155',
    fontWeight: 500,
    fontSize: '0.95rem',
};

// ── MFA Code Input (6 individual digit boxes) ─────────────────────────────────

function MfaCodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));

    const digits = value.padEnd(6, '').split('').slice(0, 6);

    const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            const next = digits.slice();
            next[i] = '';
            onChange(next.join('').trimEnd());
            if (i > 0) refs[i - 1].current?.focus();
        }
    };

    const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (!raw) return;
        // Handle paste: spread digits across remaining boxes
        const chars = raw.split('');
        const next = digits.slice();
        chars.forEach((c, offset) => {
            if (i + offset < 6) next[i + offset] = c;
        });
        onChange(next.join(''));
        const nextFocus = Math.min(i + chars.length, 5);
        refs[nextFocus].current?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        onChange(pasted);
        refs[Math.min(pasted.length, 5)].current?.focus();
    };

    return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={refs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleChange(i, e)}
                    onKeyDown={(e) => handleKey(i, e)}
                    onPaste={handlePaste}
                    style={{
                        width: '48px',
                        height: '56px',
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: d ? '2px solid #00a3ff' : '2px solid #cbd5e1',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        color: '#334155',
                        backgroundColor: d ? '#f0f9ff' : '#fff',
                    }}
                    onFocus={e => e.target.style.borderColor = '#00a3ff'}
                    onBlur={e => e.target.style.borderColor = d ? '#00a3ff' : '#cbd5e1'}
                    autoFocus={i === 0}
                />
            ))}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Login() {
    const navigate = useNavigate();

    // Credentials step
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(false);

    // MFA step
    const [step, setStep] = useState<LoginStep>('credentials');
    const [tempToken, setTempToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [useBackup, setUseBackup] = useState(false);
    const [backupCode, setBackupCode] = useState('');

    // Shared
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');

    // Auto-submit when 6 digits entered
    useEffect(() => {
        if (step === 'mfa' && !useBackup && mfaCode.replace(/\D/g, '').length === 6) {
            handleMfaSubmit();
        }
    }, [mfaCode]);

    // ── Google OAuth ──────────────────────────────────────────────────────────

    const handleGoogleSuccess = async (credentialResponse: any) => {
        try {
            setLoading(true);
            setError('');
            if (!credentialResponse.credential) {
                setError('Google did not return a credential. Please try again.');
                return;
            }
            const { token, user } = await authApi.googleLogin({
                credential: credentialResponse.credential,
                action: 'login',
            });
            authStore.login(token, user);
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            if (err.message === 'user_not_found_needs_registration') {
                navigate('/register', { replace: true });
                return;
            }
            setError(err.message || 'Google authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google Sign-In failed. Ensure this origin is authorised in Google Cloud Console.');
    };

    // ── Step 1: Credentials ───────────────────────────────────────────────────

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setEmailError('');

        const trimmedEmail = username.trim();
        if (!isValidEmail(trimmedEmail)) {
            setEmailError('Please enter a valid email address');
            setLoading(false);
            return;
        }

        try {
            const result = await authApi.login(trimmedEmail, password);

            if (isMfaChallenge(result)) {
                // CRIT-002: Server requires TOTP — switch to MFA step
                setTempToken(result.tempToken);
                setStep('mfa');
                return;
            }

            authStore.login(result.token, result.user);
            if (remember) localStorage.setItem('remember', 'true');
            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: MFA Verification ──────────────────────────────────────────────

    const handleMfaSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const code = useBackup ? backupCode.trim() : mfaCode.replace(/\D/g, '');
        if (code.length < 6) { setError('Please enter all 6 digits'); return; }

        setLoading(true);
        setError('');

        try {
            const { token, user } = await authApi.mfaVerify(tempToken, code);
            authStore.login(token, user);
            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
            setMfaCode('');
            setBackupCode('');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        setStep('credentials');
        setTempToken('');
        setMfaCode('');
        setBackupCode('');
        setError('');
        setUseBackup(false);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const cardStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        padding: 'clamp(18px, 4vw, 40px)',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        width: '100%',
        maxWidth: '440px',
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f4f8' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                <div style={cardStyle}>

                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <h1 style={{ margin: 0, fontSize: 'clamp(1.3rem, 4.8vw, 1.8rem)', fontWeight: 800, letterSpacing: '-0.5px' }}>
                                <span style={{ color: '#334155' }}>HQ</span>{' '}
                                <span style={{ color: '#10b981' }}>INVESTMENT</span>
                            </h1>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 500, textTransform: 'uppercase', marginTop: '4px' }}>
                            ISP Billing System
                        </div>
                    </div>

                    {/* ── MFA Step ── */}
                    {step === 'mfa' ? (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '56px', height: '56px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #00a3ff22, #10b98122)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 12px',
                                }}>
                                    <LockIcon style={{ color: '#00a3ff', fontSize: '28px' }} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#334155' }}>
                                    Two-Factor Verification
                                </h2>
                                <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                    {useBackup
                                        ? 'Enter one of your backup codes'
                                        : 'Enter the 6-digit code from your authenticator app'}
                                </p>
                            </div>

                            {error && (
                                <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {useBackup ? (
                                    <div>
                                        <label style={labelStyle}>Backup Code</label>
                                        <input
                                            type="text"
                                            placeholder="XXXX-XXXX"
                                            value={backupCode}
                                            onChange={e => setBackupCode(e.target.value.toUpperCase())}
                                            autoFocus
                                            style={{ ...inputStyle, textAlign: 'center', letterSpacing: '3px', fontWeight: 700, fontSize: '1.1rem' }}
                                            onFocus={e => e.target.style.borderColor = '#00a3ff'}
                                            onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ ...labelStyle, textAlign: 'center', display: 'block' }}>
                                            Authentication Code
                                        </label>
                                        <MfaCodeInput value={mfaCode} onChange={setMfaCode} />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || (!useBackup && mfaCode.length < 6) || (useBackup && backupCode.length < 8)}
                                    style={{
                                        width: '100%', padding: '14px',
                                        backgroundColor: loading ? '#94a3b8' : '#00a3ff',
                                        color: '#fff', border: 'none', borderRadius: '8px',
                                        fontSize: '1rem', fontWeight: 600,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#008ee6')}
                                    onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#00a3ff')}
                                >
                                    {loading ? 'Verifying...' : 'Verify & Sign In →'}
                                </button>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                    <button
                                        type="button"
                                        onClick={handleBackToLogin}
                                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
                                    >
                                        ← Back to login
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setUseBackup(!useBackup); setError(''); setMfaCode(''); setBackupCode(''); }}
                                        style={{ background: 'none', border: 'none', color: '#00a3ff', cursor: 'pointer', padding: 0, fontSize: '0.875rem', fontWeight: 500 }}
                                    >
                                        {useBackup ? 'Use authenticator app' : 'Use backup code'}
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        /* ── Credentials Step ── */
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <Link to="/register" style={{ color: '#008ee6', textDecoration: 'none', fontWeight: 500, fontSize: '1rem' }}>
                                    Create your free account
                                </Link>
                            </div>

                            {isGoogleConfigured && (
                                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} width={350} />
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 24px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                                or continue with email
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                            </div>

                            {error && (
                                <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                                    {error}
                                </div>
                            )}

                            <form noValidate onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={labelStyle}>Email</label>
                                    <div style={{ position: 'relative' }}>
                                        <EmailIcon
                                            fontSize="small"
                                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}
                                        />
                                        <input
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            placeholder="mujibu@gmail.com"
                                            value={username}
                                            onChange={e => {
                                                setUsername(e.target.value);
                                                if (emailError) setEmailError('');
                                            }}
                                            required
                                            style={{ ...inputStyle, paddingLeft: '40px', paddingRight: '12px' }}
                                            onFocus={e => e.target.style.borderColor = '#008ee6'}
                                            onBlur={e => {
                                                e.target.style.borderColor = '#cbd5e1';
                                                const trimmed = e.target.value.trim();
                                                if (trimmed && !isValidEmail(trimmed)) {
                                                    setEmailError('Please enter a valid email address');
                                                } else {
                                                    setEmailError('');
                                                }
                                            }}
                                        />
                                    </div>
                                    {emailError && (
                                        <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '6px' }}>{emailError}</div>
                                    )}
                                </div>

                                <div>
                                    <label style={labelStyle}>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <PasswordIcon
                                            fontSize="small"
                                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}
                                        />
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                            style={{ ...inputStyle, paddingLeft: '40px', paddingRight: '48px' }}
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

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: '#475569', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={remember}
                                            onChange={e => setRemember(e.target.checked)}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#008ee6' }}
                                        />
                                        Remember me
                                    </label>
                                    <Link to="/forgot-password" style={{ color: '#008ee6', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
                                        Forgot password?
                                    </Link>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ width: '100%', padding: '14px', backgroundColor: '#00a3ff', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', marginTop: '8px' }}
                                    onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#008ee6')}
                                    onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#00a3ff')}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        {loading ? 'Signing in...' : 'Sign In'}
                                        {!loading && <LoginIcon fontSize="small" />}
                                    </span>
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
