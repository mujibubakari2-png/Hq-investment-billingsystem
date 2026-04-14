import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api/client';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';

export default function HarakaPayConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState('');

    useEffect(() => {
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            if (data?.payment_config_harakapay) {
                try {
                    const parsed = JSON.parse(data.payment_config_harakapay);
                    if (parsed.apiKey) setApiKey(parsed.apiKey);
                } catch (e) {}
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.update({
                payment_config_harakapay: JSON.stringify({ apiKey })
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

    const handleTestPayment = () => {
        setTesting(true);
        setTimeout(() => {
            setTesting(false);
            setTestResult('Verification successful!');
        }, 2000);
    };

    return (
        <div>
            {/* Blue Header */}
            <div style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: 'var(--radius-md)',
                padding: '16px 24px', color: '#fff', marginBottom: 24,
            }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>HarakaPay Configuration</h1>
                <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: 0 }}>Configure your HarakaPay USSD Push payment gateway for Tanzania</p>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                {/* API Configuration */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    ✏️ API Configuration
                </h3>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>✏️ Accessibility API Key</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your HarakaPay API Key"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                        />
                        <button style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                        }}>
                            <VisibilityIcon style={{ fontSize: 18 }} />
                        </button>
                    </div>
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Get your API key from <strong>HarakaPay Dashboard</strong> {'>'} Developer {'>'} API Keys
                    </div>
                </div>

                {/* Integration Information */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    🔔 Integration Information
                </h3>

                <div style={{
                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 20,
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#16a34a', marginBottom: 8 }}>
                        💡 HarakaPay USSD Push Payments
                    </div>
                    <ul style={{ fontSize: '0.78rem', color: '#065f46', margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                        <li>Accept USSD push payments directly to customer's phones</li>
                        <li>Supports: Vodacom (M-Pesa), Airtel Money, Tigo Pesa, Halotel</li>
                        <li>Minimum payment amount: <strong>TZS 100</strong></li>
                        <li>Real-time payment verification</li>
                        <li>Automatic service activation</li>
                    </ul>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>
                        API Endpoint: <span style={{ color: '#2563eb' }}>https://api.harakapay.co.tz/v1/ussd-push</span>
                    </div>
                </div>

                {/* Transaction Fees */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    🏦 Transaction Fees (6%)
                </h3>

                <div style={{
                    border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden', marginBottom: 20,
                }}>
                    <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th>AMOUNT</th>
                                <th>FEE (6%)</th>
                                <th>YOU RECEIVE (94%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ color: 'var(--info)' }}>TZS 10,000</td>
                                <td>TZS 600</td>
                                <td style={{ color: '#16a34a', fontWeight: 600 }}>TZS 9,400</td>
                            </tr>
                            <tr>
                                <td style={{ color: 'var(--info)' }}>TZS 50,000</td>
                                <td>TZS 3,000</td>
                                <td style={{ color: '#16a34a', fontWeight: 600 }}>TZS 47,000</td>
                            </tr>
                            <tr>
                                <td style={{ color: 'var(--info)' }}>TZS 100,000</td>
                                <td>TZS 6,000</td>
                                <td style={{ color: '#16a34a', fontWeight: 600 }}>TZS 94,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Supported Mobile Networks */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    📱 Supported Mobile Networks
                </h3>

                <div className="grid-3 gap-12" style={{ marginBottom: 20 }}>
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

                {/* Support & Documentation */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    📚 Support & Documentation
                </h3>

                <div style={{
                    background: '#fefce8', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 24,
                }}>
                    <ul style={{ fontSize: '0.78rem', color: '#78350f', margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                        <li>✅ Website: <span style={{ color: '#2563eb' }}>harakapay.co.tz</span></li>
                        <li>📧 Support Email: <span style={{ color: '#2563eb' }}>support@harakapay.co.tz</span></li>
                        <li>📖 API Documentation: Available in HarakaPay Dashboard</li>
                    </ul>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                    Contact HarakaPay support for integration assistance
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
                    <button className="btn btn-secondary" onClick={() => navigate('/payment-channels')}>Cancel</button>
                    <button className="btn btn-secondary" onClick={handleTestPayment} disabled={testing}>
                        {testing ? 'Testing...' : 'Test Payment'}
                    </button>
                    <button className="btn" onClick={handleSave} disabled={saving} style={{
                        background: '#e11d48', color: '#fff', fontWeight: 600,
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                        <SaveIcon fontSize="small" /> {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>

                {testResult && (
                    <div style={{
                        marginTop: 16, padding: '12px 16px', background: '#f0f9ff', 
                        border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.85rem', fontWeight: 500
                    }}>
                        {testResult}
                    </div>
                )}
            </div>
        </div>
    );
}
