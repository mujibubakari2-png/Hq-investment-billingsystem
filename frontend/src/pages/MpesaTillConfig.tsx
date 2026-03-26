import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function MpesaTillConfig() {
    const navigate = useNavigate();
    const [tillType, setTillType] = useState('Personal Till');
    const [tillNumber, setTillNumber] = useState('4975982');
    const [consumerKey, setConsumerKey] = useState('');
    const [consumerSecret, setConsumerSecret] = useState('');
    const [saved, setSaved] = useState(false);

    const [error, setError] = useState('');

    const handleSave = () => {
        if (tillType === 'Business Till' && !consumerKey) {
            setError('Consumer Key is required');
            return;
        }
        setError('');
        setSaved(true);
        setTimeout(() => navigate('/payment-channels'), 1500);
    };

    return (
        <div>
            {/* Red Header */}
            <div style={{
                background: '#e11d48', borderRadius: 'var(--radius-md)',
                padding: '16px 24px', color: '#fff', marginBottom: 24,
            }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>M-Pesa Till Configuration</h1>
                <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: 0 }}>Configure your M-Pesa Buy Goods Till payment gateway</p>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid #fca5a5' }}>
                    {error}
                </div>
            )}

            {/* M-Pesa Buy Goods Till info */}
            <div style={{
                background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                padding: '12px 16px', marginBottom: 24,
            }}>
                <div style={{ fontSize: '0.85rem', color: '#065f46' }}>
                    <strong>🟢 M-Pesa Buy Goods Till</strong><br />
                    Configure your M-Pesa Buy Goods Till to accept payments directly to your till number. Choose between Business Till (requires API credentials) or Personal Till (simple till number only).
                </div>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                {/* Till Type Selection */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    Till Type Selection
                </h3>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        ⚙️ Select Till Type <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <select className="form-select" value={tillType} onChange={e => setTillType(e.target.value)}>
                        <option>Personal Till</option>
                        <option>Business Till</option>
                    </select>
                    <div className="form-hint">{tillType === 'Personal Till' ? 'Business Till' : 'Personal Till'}</div>
                </div>

                {/* Till Configuration */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🏪 {tillType === 'Personal Till' ? 'Personal Till Configuration' : 'Business Till Configuration'}
                </h3>

                {tillType === 'Personal Till' ? (
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            📱 Personal Till Number <span style={{ color: '#e11d48' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem' }}>🏪</span>
                            <input
                                type="text"
                                className="form-input"
                                value={tillNumber}
                                onChange={e => setTillNumber(e.target.value)}
                                style={{ flex: 1 }}
                            />
                        </div>
                        <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 12 }} />
                            Your personal M-Pesa Buy Goods till number
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                                Consumer Key <span style={{ color: '#e11d48' }}>*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={consumerKey}
                                onChange={e => setConsumerKey(e.target.value)}
                                placeholder="Enter Consumer Key"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                                Consumer Secret <span style={{ color: '#e11d48' }}>*</span>
                            </label>
                            <input
                                type="password"
                                className="form-input"
                                value={consumerSecret}
                                onChange={e => setConsumerSecret(e.target.value)}
                                placeholder="Enter Consumer Secret"
                            />
                        </div>
                    </div>
                )}

                {/* How M-Pesa Till Payments Work */}
                <h3 style={{ color: '#1d4ed8', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    📚 How M-Pesa Till Payments Work
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: '#dbeafe',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#1d4ed8', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                        }}>1</div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                <ShoppingCartIcon style={{ fontSize: 14, marginRight: 4 }} />
                                Customer Checkout
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Customer selects M-Pesa Till payment option
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: '#fef3c7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#d97706', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                        }}>2</div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                <SyncIcon style={{ fontSize: 14, marginRight: 4 }} />
                                Payment Processing
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                System processes payment via M-Pesa API
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: '#dcfce7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#16a34a', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                        }}>3</div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                <CheckCircleIcon style={{ fontSize: 14, marginRight: 4 }} />
                                Account Activation
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Service activated upon payment confirmation
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                    Test your configuration before going live
                </div>

                {saved && (
                    <div style={{
                        background: '#dcfce7', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                        padding: '10px 16px', marginBottom: 12, color: '#065f46', fontWeight: 500, fontSize: '0.85rem',
                    }}>
                        ✅ Configuration saved successfully! Redirecting...
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/payment-channels')}>+ Cancel</button>
                    <button className="btn" onClick={handleSave} style={{
                        background: '#e11d48', color: '#fff', fontWeight: 600,
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <SaveIcon fontSize="small" /> Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
