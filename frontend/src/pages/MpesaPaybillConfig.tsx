import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api/client';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SecurityIcon from '@mui/icons-material/Security';

export default function MpesaPaybillConfig() {
    const navigate = useNavigate();
    const [environment, setEnvironment] = useState('sandbox-Sandbox/Testing');
    const [shortcode, setShortcode] = useState('174379');
    const [consumerKey, setConsumerKey] = useState('');
    const [consumerSecret, setConsumerSecret] = useState('');
    const [passkey, setPasskey] = useState('');
    const [authType, setAuthType] = useState('English (Swahili)');
    const [lipaNaMpesaShortcode, setLipaNaMpesaShortcode] = useState('174379');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [ussdVersion, setUssdVersion] = useState('Version 1');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            if (data?.payment_config_mpesa_paybill) {
                try {
                    const parsed = JSON.parse(data.payment_config_mpesa_paybill);
                    if (parsed.environment) setEnvironment(parsed.environment);
                    if (parsed.shortcode) setShortcode(parsed.shortcode);
                    if (parsed.consumerKey) setConsumerKey(parsed.consumerKey);
                    if (parsed.consumerSecret) setConsumerSecret(parsed.consumerSecret);
                    if (parsed.passkey) setPasskey(parsed.passkey);
                    if (parsed.authType) setAuthType(parsed.authType);
                    if (parsed.lipaNaMpesaShortcode) setLipaNaMpesaShortcode(parsed.lipaNaMpesaShortcode);
                    if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
                    if (parsed.ussdVersion) setUssdVersion(parsed.ussdVersion);
                } catch (e) {}
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.update({
                payment_config_mpesa_paybill: JSON.stringify({ 
                    environment, shortcode, consumerKey, consumerSecret, passkey, 
                    authType, lipaNaMpesaShortcode, paymentMethod, ussdVersion 
                })
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
            {/* Blue Header */}
            <div style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', borderRadius: 'var(--radius-md)',
                padding: '16px 24px', color: '#fff', marginBottom: 24,
            }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>M-Pesa Configuration</h1>
                <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: 0 }}>Configure your M-Pesa paybill payment gateway settings</p>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                {/* Key Account Settings */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔑 Key Account Settings
                </h3>

                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>🟢 API Environment</label>
                    <select className="form-select" value={environment} onChange={e => setEnvironment(e.target.value)} style={{ background: '#0ea5e9', color: '#fff', fontWeight: 600 }}>
                        <option>sandbox-Sandbox/Testing</option>
                        <option>production-Live/Production</option>
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            Shortcode Number <span style={{ color: '#e11d48' }}>*</span>
                        </label>
                        <input type="text" className="form-input" value={shortcode} onChange={e => setShortcode(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>🔗 Consumer Secret</label>
                        <input type="text" className="form-input" value={consumerSecret} onChange={e => setConsumerSecret(e.target.value)} />
                    </div>
                </div>

                <div className="form-hint" style={{ marginBottom: 20 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Obtain credentials from <span style={{ color: '#2563eb' }}>Safaricom Developer Portal</span> {'>'} ...
                </div>

                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Consumer Key <span style={{ color: '#e11d48' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                        <input type="password" className="form-input" value={consumerKey} onChange={e => setConsumerKey(e.target.value)} />
                        <button style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                        }}>
                            <VisibilityIcon style={{ fontSize: 18 }} />
                        </button>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Passkey</label>
                    <input type="text" className="form-input" value={passkey} onChange={e => setPasskey(e.target.value)} placeholder="bfb279fb9305c..." />
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Lipa na M-Pesa passkey. For sandbox: passkey is usually generated by the platform.
                    </div>
                </div>

                {/* Business Configuration */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🏢 Business Configuration
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>💡 Lipa Na M-pesa</label>
                        <select className="form-select" value={authType} onChange={e => setAuthType(e.target.value)}>
                            <option>English (Swahili)</option>
                            <option>Swahili Only</option>
                            <option>English Only</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            📄 Lipa Na M-pesa Shortcode
                        </label>
                        <input type="text" className="form-input" value={lipaNaMpesaShortcode} onChange={e => setLipaNaMpesaShortcode(e.target.value)} placeholder="Party B shortcode" />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Party B</label>
                    <input type="text" className="form-input" value="bfb279fb9ed56f430c86bc1636d..." readOnly style={{ background: '#f9fafb' }} />
                </div>

                {/* Offline Payment Settings */}
                <h3 style={{ color: '#0ea5e9', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    💳 Offline Payment Settings
                </h3>

                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>📱 Bypass Offline Pay Method</label>
                    <select className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="">YES</option>
                        <option value="no">NO</option>
                    </select>
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Enable this to bypass all offline payment methods. Set to manual verifications.
                    </div>
                </div>

                {/* USSD Version */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>🔢 USSD Version</label>
                    <select className="form-select" value={ussdVersion} onChange={e => setUssdVersion(e.target.value)}>
                        <option>Version 1</option>
                        <option>Version 2</option>
                    </select>
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Select the API version used to call for STK transactions
                    </div>
                </div>

                {/* Tigopesa CSS URL */}
                <div style={{
                    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 16,
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e11d48', marginBottom: 6 }}>
                        Tigopesa CSS URL:
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: 8 }}>
                        This is only needed to update your CSS URL for offline payment support
                    </div>
                    <button className="btn" style={{
                        background: '#16a34a', color: '#fff', fontWeight: 600,
                        padding: '6px 14px', fontSize: '0.78rem',
                    }}>
                        🔗 Register URL
                    </button>
                </div>

                <div className="form-hint" style={{ marginBottom: 16 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    contact admin@hqinvestmentbilling.com for other configurations
                </div>

                {/* Prompt Configuration */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔔 Prompt Configuration
                </h3>

                <div style={{
                    background: '#fefce8', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 24,
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#92400e', marginBottom: 8 }}>
                        <SecurityIcon style={{ fontSize: 14, marginRight: 4 }} />
                        M-Pesa STK Gateway Configuration
                    </div>
                    <div style={{
                        background: '#1e293b', color: '#a3e635', borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.8,
                    }}>
                        <div>Go to business and register the following:</div>
                        <div>URL: <span style={{ color: '#38bdf8' }}>https://api.example.com/callback</span></div>
                        <div>and also set your IP configuration for</div>
                        <div>WAF and Firewall: <span style={{ color: '#38bdf8' }}>configure as above</span></div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                    Validate your configuration before switching to production
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
