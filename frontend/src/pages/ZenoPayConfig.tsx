import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import LinkIcon from '@mui/icons-material/Link';

export default function ZenoPayConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => navigate('/payment-channels'), 1500);
    };

    return (
        <div>
            {/* Dark Blue Header */}
            <div style={{
                background: 'linear-gradient(135deg, #1e3a5f, #0f172a)', borderRadius: 'var(--radius-md)',
                padding: '16px 24px', color: '#fff', marginBottom: 24,
            }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>ZenoPay Configuration</h1>
                <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: 0 }}>Configure your ZenoPay Mobile Money Tanzania payment gateway</p>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                {/* API Configuration */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    ✏️ API Configuration
                </h3>

                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>✏️ ZenoPay API Key</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                        }}>✏️</div>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your ZenoPay API key"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            style={{ paddingLeft: 34 }}
                        />
                        <button style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                        }}>
                            <VisibilityIcon style={{ fontSize: 18 }} />
                        </button>
                    </div>
                </div>
                <div className="form-hint" style={{ marginBottom: 24 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Get your API key from ZenoPay dashboard
                </div>

                {/* Webhook Configuration */}
                <h3 style={{ color: '#d97706', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔗 Webhook Configuration
                </h3>

                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        ✏️ Webhook URL (Optional)
                    </label>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                        }}>
                            <LinkIcon style={{ fontSize: 16 }} />
                        </div>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="https://yourdomain.com/webhook"
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                            style={{ paddingLeft: 34 }}
                        />
                    </div>
                </div>
                <div className="form-hint" style={{ marginBottom: 24 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Optional: URL to receive payment notifications. Default callback URL: <span style={{ color: '#2563eb' }}>https://portal.zurichbilling.com/app.php?drt=callback/zenopay</span>
                </div>

                {/* Integration Information */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    🔔 Integration Information
                </h3>

                <div style={{
                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 24,
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#16a34a', marginBottom: 8 }}>
                        💡 ZenoPay Mobile Money Tanzania
                    </div>
                    <ul style={{ fontSize: '0.78rem', color: '#065f46', margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                        <li>Supports Tanzanian mobile money payments</li>
                        <li>Phone numbers should be in format: <strong>07XXXXXXXX</strong></li>
                        <li>Automatic payment verification via webhooks</li>
                        <li>Real-time payment status updates</li>
                    </ul>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
                        API Endpoint: <span style={{ color: '#2563eb' }}>https://zenoapi.com/api/payments/mobile_money_tanzania</span>
                    </div>
                </div>

                {/* Supported Networks */}
                <h3 style={{ color: '#d97706', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    📱 Supported Networks
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { name: 'M-Pesa Tanzania', color: '#16a34a', border: '#a7f3d0' },
                        { name: 'Tigo Pesa', color: '#e11d48', border: '#fecdd3' },
                        { name: 'Airtel Money', color: '#d97706', border: '#fde68a' },
                    ].map(network => (
                        <div key={network.name} style={{
                            padding: '20px 16px', borderRadius: 'var(--radius-sm)',
                            border: `2px solid ${network.border}`, textAlign: 'center',
                        }}>
                            <PhoneAndroidIcon style={{ fontSize: 28, color: network.color, marginBottom: 4 }} />
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: network.color }}>{network.name}</div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                    Secure payment processing with ZenoPay
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
