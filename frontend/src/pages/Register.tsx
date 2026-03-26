import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PersonIcon from '@mui/icons-material/Person';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PublicIcon from '@mui/icons-material/Public';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Helper for step icons
const StepIcon = ({ step, currentStep, label }: any) => {
    const isCompleted = step < currentStep;
    const isActive = step === currentStep;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1 }}>
            <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: isCompleted ? '#22c55e' : (isActive ? '#0ea5e9' : '#ffffff'),
                border: isActive ? 'none' : (isCompleted ? 'none' : '1px solid #cbd5e1'),
                color: (isActive || isCompleted) ? '#ffffff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: '1rem',
                boxShadow: isActive ? '0 0 0 4px rgba(14, 165, 233, 0.2)' : 'none'
            }}>
                {isCompleted ? <CheckCircleIcon style={{ fontSize: '1.25rem' }} /> : step}
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: (isActive || isCompleted) ? '#22c55e' : '#94a3b8' }}>
                {label}
            </span>
        </div>
    );
};

export default function Register() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        fullName: '', email: '', phone: '', password: '', confirmPassword: '',
        otp: ['', '', '', '', '', ''],
        companyName: '', city: '', country: '', termsAccepted: false, planId: ''
    });
    const [_, setPlans] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get('/api/saas-plans')
            .then(res => {
                setPlans(res.data);
                if (res.data.length > 0) {
                    setFormData(prev => ({ ...prev, planId: res.data[0].id }));
                }
            })
            .catch(err => console.error("Failed to load plans", err));
    }, []);

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => setStep(prev => Math.min(prev + 1, 3));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/api/auth/register', {
                fullName: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                companyName: formData.companyName,
                planId: formData.planId
            });
            alert(res.data.message || "Registration complete!");
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.error || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f9', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '700px' }}>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>

                    {/* Stepper Header */}
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: '80px', marginBottom: '40px' }}>
                        {/* Connecting Line */}
                        <div style={{ position: 'absolute', top: '20px', left: 'calc(50% - 100px)', right: 'calc(50% - 100px)', height: '2px', backgroundColor: '#e2e8f0', zIndex: 0 }} />

                        <StepIcon step={1} currentStep={step} label="User Info" />
                        <StepIcon step={2} currentStep={step} label="Verify OTP" />
                        <StepIcon step={3} currentStep={step} label="Company" />
                    </div>

                    {step === 1 && (
                        <div className="fade-in">
                            <button style={{ width: '100%', padding: '12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" style={{ width: '18px' }} />
                                Continue with Google
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                                or register manually
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                            </div>

                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', margin: '0 0 24px 0', fontSize: '1.1rem' }}>
                                <PersonIcon style={{ color: '#0ea5e9' }} /> Personal Information
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        <PersonIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Full Name
                                    </label>
                                    <input type="text" placeholder="John Doe" value={formData.fullName} onChange={e => updateField('fullName', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        <MailOutlineIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Email Address
                                    </label>
                                    <input type="email" placeholder="john@company.com" value={formData.email} onChange={e => updateField('email', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    <PhoneIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Phone Number
                                </label>
                                <input type="text" placeholder="255XXXXXXXXX" value={formData.phone} onChange={e => updateField('phone', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#e2e8f0', textAlign: 'center', lineHeight: '12px', fontSize: '9px', fontWeight: 'bold' }}>i</span>
                                    We'll send a verification code to your email
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        <LockIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Create Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showPass ? "text" : "password"} placeholder="••••••••••••" value={formData.password} onChange={e => updateField('password', e.target.value)} style={{ width: '100%', padding: '12px', paddingRight: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                                        <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                            {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        <LockIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Confirm Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showConfirmPass ? "text" : "password"} placeholder="••••••••••••" value={formData.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} style={{ width: '100%', padding: '12px', paddingRight: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                                        <button onClick={() => setShowConfirmPass(!showConfirmPass)} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                            {showConfirmPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Password strength mock */}
                            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                                <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginBottom: '12px' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} /> 12+ characters</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} /> Uppercase</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} /> Lowercase</div>
                                </div>
                                <div style={{ display: 'flex', gap: '24px', fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} /> Number</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} /> Special (!@#$)</div>
                                </div>
                            </div>

                            <button onClick={handleNext} style={{ width: '100%', padding: '14px', backgroundColor: '#0ea5e9', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                                Continue to Verify OTP <ArrowRightAltIcon />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="fade-in" style={{ textAlign: 'center' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#0f172a', margin: '0 0 32px 0', fontSize: '1.2rem' }}>
                                <MailOutlineIcon style={{ color: '#0ea5e9' }} /> Verify Your Email
                            </h3>

                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#0ea5e9', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                                <MailOutlineIcon style={{ fontSize: '2.5rem' }} />
                            </div>

                            <p style={{ color: '#475569', marginBottom: '24px' }}>Enter the 6-digit code sent to<br /><strong>{formData.email || 'your@email.com'}</strong></p>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
                                {[0, 1, 2, 3, 4, 5].map(idx => (
                                    <input key={idx} type="text" maxLength={1} style={{ width: '48px', height: '56px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                ))}
                            </div>

                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '24px' }}>
                                Didn't receive the code?<br />
                                <a href="#" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                                    ⟳ Resend Code
                                </a>
                            </p>

                            <button onClick={handleNext} style={{ width: '100%', padding: '14px', backgroundColor: '#0ea5e9', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px' }}>
                                <CheckCircleIcon fontSize="small" /> Verify Code
                            </button>
                            <button onClick={handleBack} style={{ width: '100%', padding: '14px', backgroundColor: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                                <ArrowBackIcon fontSize="small" /> Back
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="fade-in">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', margin: '0 0 24px 0', fontSize: '1.1rem' }}>
                                <BusinessIcon style={{ color: '#0ea5e9' }} /> Company Information
                            </h3>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    <BusinessIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Company Name
                                </label>
                                <input type="text" placeholder="Your Company Ltd" value={formData.companyName} onChange={e => updateField('companyName', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        <LocationCityIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> City
                                    </label>
                                    <input type="text" placeholder="Dar es Salaam" value={formData.city} onChange={e => updateField('city', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        <PublicIcon fontSize="small" style={{ color: '#0ea5e9', fontSize: '1.1rem' }} /> Country
                                    </label>
                                    <select value={formData.country} onChange={e => updateField('country', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}>
                                        <option value="">🇹🇿 Tanzania</option>
                                        <option value="KE">🇰🇪 Kenya</option>
                                        <option value="UG">🇺🇬 Uganda</option>
                                        <option value="RW">🇷🇼 Rwanda</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ padding: '16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <input type="checkbox" checked={formData.termsAccepted} onChange={e => updateField('termsAccepted', e.target.checked)} style={{ marginTop: '4px', cursor: 'pointer' }} />
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                                    I agree to the <a href="#" style={{ color: '#0ea5e9', fontWeight: 600 }}>Terms of Service</a> and <a href="#" style={{ color: '#0ea5e9', fontWeight: 600 }}>Privacy Policy</a>. I understand my registration will be reviewed by an admin.
                                </p>
                            </div>

                            {error && (
                                <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem' }}>
                                    {error}
                                </div>
                            )}

                            <button onClick={handleRegister} disabled={!formData.termsAccepted || loading} style={{ width: '100%', padding: '14px', backgroundColor: '#0ea5e9', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: (formData.termsAccepted && !loading) ? 'pointer' : 'not-allowed', opacity: (formData.termsAccepted && !loading) ? 1 : 0.7, marginBottom: '16px' }}>
                                {loading ? 'Registering...' : '🚀 Complete Registration'}
                            </button>

                            <button onClick={handleBack} style={{ width: '100%', padding: '14px', backgroundColor: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
                                <ArrowBackIcon fontSize="small" /> Back
                            </button>

                            {/* What happens next */}
                            <div style={{ backgroundColor: '#f0f9ff', padding: '24px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#0ea5e9', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>i</div>
                                    What happens next?
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {['Email verification link sent to your inbox', 'Admin review (usually within 24 hours)', 'Approval confirmation via email and SMS', 'Start managing your billing instantly!'].map((text, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '0.85rem', color: '#475569' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#0ea5e9', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>{i + 1}</div>
                                            {text}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: '#64748b' }}>
                    Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#0ea5e9', fontWeight: 600, cursor: 'pointer' }}>Sign in here &rarr;</span>
                </div>
            </div>
        </div>
    );
}
