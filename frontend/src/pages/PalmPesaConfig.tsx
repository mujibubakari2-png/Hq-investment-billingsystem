import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api/client';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import LinkIcon from '@mui/icons-material/Link';

export default function PalmPesaConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('337');
    const [apiToken, setApiToken] = useState('');
    const [secretKey, setSecretKey] = useState('F12457789611');
    const [callbackUrl, setCallbackUrl] = useState('');
    const [cancelUrl, setCancelUrl] = useState('');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            if (data?.payment_config_palmpesa) {
                try {
                    const parsed = JSON.parse(data.payment_config_palmpesa);
                    if (parsed.apiKey) setApiKey(parsed.apiKey);
                    if (parsed.apiToken) setApiToken(parsed.apiToken);
                    if (parsed.secretKey) setSecretKey(parsed.secretKey);
                    if (parsed.callbackUrl) setCallbackUrl(parsed.callbackUrl);
                    if (parsed.cancelUrl) setCancelUrl(parsed.cancelUrl);
                } catch (e) {}
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.update({
                payment_config_palmpesa: JSON.stringify({ apiKey, apiToken, secretKey, callbackUrl, cancelUrl })
            });
            setSaved(true);
            setTimeout(() => navigate('/payment-channels'), 1500);
        } catch (err) {
            console.error(err);
            alert('Failed to save config');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {/* Green Header */}
            <div style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)', borderRadius: 'var(--radius-md)',
                padding: '16px 24px', color: '#fff', marginBottom: 24,
            }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>PalmPesa Configuration</h1>
                <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: 0 }}>Configure your PalmPesa Mobile Money Transaction payment gateway</p>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                {/* API Configuration */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    ✏️ API Configuration
                </h3>

                <div className="grid-2 gap-16" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            ✏️ API Account ID <span style={{ color: '#e11d48' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>⚙️</span>
                            <input type="text" className="form-input" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        <div className="form-hint">
                            <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                            Your account ID or client ID from PalmPesa dashboard account
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            🔒 PalmPesa API Token
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input type="password" className="form-input" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="Enter PalmPesa API Token" />
                            <button style={{
                                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                            }}>
                                <VisibilityIcon style={{ fontSize: 18 }} />
                            </button>
                        </div>
                        <div className="form-hint">
                            <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                            Your API Token from PalmPesa developer account
                        </div>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>🔑 Secret Key</label>
                    <input type="text" className="form-input" value={secretKey} onChange={e => setSecretKey(e.target.value)} />
                </div>

                <div className="form-hint" style={{ marginBottom: 20 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Obtain credentials from PalmPesa. For sandbox: use test credentials provided by the platform.
                </div>

                {/* URL Configuration */}
                <h3 style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    <LinkIcon style={{ fontSize: 16, marginRight: 4 }} /> URL Configuration
                </h3>

                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>🔗 callbackURL</label>
                    <input type="text" className="form-input" value={callbackUrl} onChange={e => setCallbackUrl(e.target.value)} placeholder="https://yourdomain.com/callback" />
                </div>

                <div style={{
                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px', fontSize: '0.78rem', color: '#065f46', marginBottom: 16,
                }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    This webhook URL will receive payment notifications on callback. Set in the app callback section
                </div>

                <div className="grid-2 gap-16" style={{ marginBottom: 20 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            🔗 Success Return URL
                        </label>
                        <input type="text" className="form-input" placeholder="e.g. https://example.com/success" />
                        <div className="form-hint">
                            <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                            URL to redirect if payment is successful (for redirection)
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            ❌ Cancel URL
                        </label>
                        <input type="text" className="form-input" value={cancelUrl} onChange={e => setCancelUrl(e.target.value)} placeholder="e.g. https://example.com/cancel" />
                        <div className="form-hint">
                            <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                            URL to redirect if payment is cancelled (for redirection)
                        </div>
                    </div>
                </div>

                {/* Integration Information */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    🔔 Integration Information
                </h3>

                <div style={{
                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 16,
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#16a34a', marginBottom: 8 }}>
                        💡 PalmPesa Mobile Money Tanzania
                    </div>
                    <ul style={{ fontSize: '0.78rem', color: '#065f46', margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                        <li>Supports Tanzanian mobile money payments</li>
                        <li>Automatic payment verification via webhooks</li>
                        <li>Real-time payment status updates</li>
                        <li>Multi-carrier support: M-Pesa, Tigo Pesa, Airtel</li>
                    </ul>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
                        Base URL: <span style={{ color: '#2563eb' }}>https://api.palmpesa.com/v1</span>
                    </div>
                </div>

                {/* How to Use (Terminal) */}
                <div style={{
                    background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 24,
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#92400e', marginBottom: 8 }}>
                        📚 How to Get Credentials:
                    </div>
                    <ol style={{ fontSize: '0.78rem', color: '#78350f', margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                        <li>Register at <span style={{ color: '#2563eb' }}>https://palmpesa.com/register</span></li>
                        <li>Go to Settings {'>'} API Configuration</li>
                        <li>Find your credentials on the API credentials page</li>
                    </ol>
                </div>

                {/* Supported Networks */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    📱 Supported Networks
                </h3>

                <div className="grid-3 gap-12" style={{ marginBottom: 24 }}>
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
                    Contact PalmPesa support for integration assistance with API Tokens
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
                    <button className="btn" onClick={handleSave} disabled={saving} style={{
                        background: '#e11d48', color: '#fff', fontWeight: 600,
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                        <SaveIcon fontSize="small" /> {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
