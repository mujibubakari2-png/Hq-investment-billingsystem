import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyIcon from '@mui/icons-material/Key';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import SearchIcon from '@mui/icons-material/Search';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Footer from '../components/layout/Footer';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const [activeStep, setActiveStep] = useState(1);
    const [otpInputs, setOtpInputs] = useState(['', '', '', '', '', '']);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleFindAccount = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authApi.requestPasswordResetOtp({ email });
            console.log("TESTING ONLY - Password Reset OTP:", res.otp);
            setActiveStep(2);
            setSuccess(''); // Clear any previous success message to show toast
        } catch (err: any) {
            setError(err.message || 'Failed to find account');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await authApi.requestPasswordResetOtp({ email });
            console.log("TESTING ONLY - Resent Password Reset OTP:", res.otp);
            // Just show a subtle success state if needed
        } catch (err: any) {
            setError(err.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = otpInputs.join('');
        if (code.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await authApi.verifyPasswordResetOtp({ email, otp: code });
            // Successfully validated physically
            setActiveStep(3);
            setSuccess('');
        } catch (err: any) {
            setError(err.message || 'Invalid or expired verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await authApi.resetPassword({ email, password, otp: otpInputs.join('') });
            setSuccess('Password reset successfully!');
        } catch (err: any) {
            setError(err.message || 'Failed to reset password. The code may be invalid or expired.');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        const newOtp = [...otpInputs];
        newOtp[index] = value.slice(-1); // Only take latest char
        setOtpInputs(newOtp);
        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f4f8' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '440px' }}>
                <button
                    onClick={() => {
                        if (activeStep > 1 && !success) setActiveStep(activeStep - 1);
                        else navigate('/login');
                    }}
                    style={{ background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', fontSize: '0.95rem' }}
                >
                    <ArrowBackIcon fontSize="small" /> {activeStep > 1 && !success ? 'Back' : 'Back to Login'}
                </button>

                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    {/* Header Top Section (Yellow) */}
                    <div style={{ backgroundColor: '#ffbd00', padding: '32px 20px', textAlign: 'center', color: '#ffffff' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <KeyIcon style={{ fontSize: '2.5rem', color: '#ffffff' }} />
                        </div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600 }}>Account Recovery</h2>
                        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>We'll get you back in within minutes.</p>
                    </div>

                    <div style={{ padding: '32px 32px 40px 32px' }}>
                        {/* Stepper */}
                        {!success && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
                                {[1, 2, 3].map((step, idx) => {
                                    const isCompleted = step < activeStep;
                                    const isCurrent = step === activeStep;
                                    return (
                                        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                backgroundColor: isCompleted ? '#10b981' : (isCurrent ? '#ffbd00' : '#e2e8f0'),
                                                color: (isCompleted || isCurrent) ? '#ffffff' : '#64748b',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 600, fontSize: '1rem'
                                            }}>
                                                {isCompleted ? <CheckIcon fontSize="small" /> : step}
                                            </div>
                                            {idx < 2 && <div style={{ width: '40px', height: '2px', backgroundColor: '#e2e8f0' }} />}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {error && (
                            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                                {error}
                            </div>
                        )}

                        {activeStep === 1 && (
                            <form onSubmit={handleFindAccount} className="fade-in">
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <label style={{ color: '#475569', fontWeight: 500, fontSize: '1.05rem' }}>
                                        Enter the email address linked to your account
                                    </label>
                                </div>

                                <div style={{ position: 'relative', marginBottom: '24px' }}>
                                    <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRight: 'none', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', color: '#64748b' }}>
                                        <MailOutlineIcon />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '12px 16px 12px 64px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={(e) => { e.target.style.borderColor = '#ffbd00'; }}
                                        onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    style={{
                                        width: '100%', padding: '14px', backgroundColor: '#ffbd00', color: '#ffffff',
                                        border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        cursor: (loading || !email) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s',
                                        marginBottom: '24px'
                                    }}
                                    onMouseOver={(e) => { if (!loading && email) e.currentTarget.style.backgroundColor = '#e6aa00'; }}
                                    onMouseOut={(e) => { if (!loading && email) e.currentTarget.style.backgroundColor = '#ffbd00'; }}
                                >
                                    <SearchIcon fontSize="small" />
                                    {loading ? 'Searching...' : 'Search for My Account'}
                                </button>

                                <div style={{ textAlign: 'center', fontSize: '0.95rem', color: '#64748b' }}>
                                    New to HQInvestment? <span onClick={() => navigate('/register')} style={{ color: '#ffbd00', fontWeight: 600, cursor: 'pointer' }}>Sign up free</span>
                                </div>
                            </form>
                        )}

                        {activeStep === 2 && (
                            <form className="fade-in" onSubmit={handleVerifyOtp}>
                                {/* Account Found Card */}
                                <div style={{ backgroundColor: '#d1e7dd', border: '1px solid #badbcc', borderRadius: '8px', padding: '16px', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f5132', fontWeight: 600, marginBottom: '16px', fontSize: '1.05rem' }}>
                                        <CheckCircleIcon fontSize="small" /> Account Found
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', fontSize: '0.95rem', color: '#475569' }}>
                                        <div style={{ color: '#64748b' }}>Email</div>
                                        <div style={{ color: '#0f172a', fontWeight: 500 }}>{email}</div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                    <label style={{ color: '#475569', fontWeight: 500, fontSize: '1.05rem' }}>
                                        Enter the 6-digit code from your email
                                    </label>
                                </div>

                                {/* OTP Inputs */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                                    {otpInputs.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`otp-${idx}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                            style={{
                                                width: '40px', height: '48px', fontSize: '1.25rem', textAlign: 'center',
                                                borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none',
                                                color: '#334155', fontWeight: 500
                                            }}
                                            onFocus={(e) => { e.target.style.borderColor = '#ffbd00'; }}
                                            onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || otpInputs.join('').length !== 6}
                                    style={{
                                        width: '100%', padding: '14px', backgroundColor: '#ffbd00', color: '#0f172a',
                                        border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        cursor: (loading || otpInputs.join('').length !== 6) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s',
                                        marginBottom: '24px'
                                    }}
                                    onMouseOver={(e) => { if (!loading && otpInputs.join('').length === 6) e.currentTarget.style.backgroundColor = '#e6aa00'; }}
                                    onMouseOut={(e) => { if (!loading && otpInputs.join('').length === 6) e.currentTarget.style.backgroundColor = '#ffbd00'; }}
                                >
                                    <CheckIcon fontSize="small" />
                                    {loading ? 'Verifying...' : 'Verify & Continue →'}
                                </button>

                                <div style={{ textAlign: 'center', fontSize: '0.95rem', color: '#64748b' }}>
                                    <div style={{ marginBottom: '8px' }}>Expires: 30:00</div>
                                    <div onClick={handleResendOtp} style={{ color: '#ffca28', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '16px' }}>
                                        <span>↻</span> Resend Code
                                    </div>
                                    <div
                                        onClick={() => setActiveStep(1)}
                                        style={{ color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <ArrowBackIcon fontSize="small" style={{ fontSize: '0.9rem' }} /> Different email
                                    </div>
                                </div>
                            </form>
                        )}

                        {activeStep === 3 && !success && (
                            <form className="fade-in" onSubmit={handleResetPassword}>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <label style={{ color: '#475569', fontWeight: 500, fontSize: '1.05rem' }}>
                                        Choose your new password
                                    </label>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <input
                                        type="password"
                                        placeholder="New Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={(e) => { e.target.style.borderColor = '#ffbd00'; }}
                                        onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                                    />
                                </div>
                                <div style={{ marginBottom: '24px' }}>
                                    <input
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={(e) => { e.target.style.borderColor = '#ffbd00'; }}
                                        onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !password || !confirmPassword}
                                    style={{
                                        width: '100%', padding: '14px', backgroundColor: '#ffbd00', color: '#0f172a',
                                        border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 600,
                                        cursor: (loading || !password || !confirmPassword) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => { if (!loading && password && confirmPassword) e.currentTarget.style.backgroundColor = '#e6aa00'; }}
                                    onMouseOut={(e) => { if (!loading && password && confirmPassword) e.currentTarget.style.backgroundColor = '#ffbd00'; }}
                                >
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        )}

                        {success && (
                            <div className="fade-in" style={{ textAlign: 'center', paddingTop: '20px' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                                    <CheckIcon fontSize="large" />
                                </div>
                                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Password Reset — You're Good to Go!</h3>
                                <p style={{ color: '#64748b', marginBottom: '24px' }}>Your password has been updated. You can now sign in with your new credentials.</p>
                                <button
                                    onClick={() => navigate('/login')}
                                    style={{ width: '100%', padding: '14px', backgroundColor: '#ffbd00', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Sign In to Dashboard →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>
            <Footer />
        </div>
    );
}
