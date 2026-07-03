import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentChannelTestApi } from '../api';
import { loadProviderChannel, saveProviderChannel } from '../utils/paymentChannelConfig';
import { getPublicApiBase } from '../utils/config';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';

const ENV_BASE_URL = (import.meta.env.VITE_HARAKAPAY_API_URL as string | undefined)?.trim() || '';

export default function HarakaPayConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [apiUrl, setApiUrl] = useState(ENV_BASE_URL);
    const [showKey, setShowKey] = useState(false);
    const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    // Validation state
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{
        success: boolean;
        message: string;
        statusCode?: number;
    } | null>(null);

    useEffect(() => {
        loadProviderChannel('HARAKAPAY').then((channel: any) => {
            if (!channel) return;
            setHasSavedApiKey(!!channel.hasApiKey);
            if (channel.config?.apiUrl) setApiUrl(channel.config.apiUrl);
        }).catch(console.error);
    }, []);

    const handleValidateAndSave = async () => {
        if (!apiKey.trim() && !hasSavedApiKey) {
            setValidationResult({ success: false, message: '❌ API Key is required before saving.' });
            return;
        }
        if (!apiUrl.trim()) {
            setValidationResult({ success: false, message: '❌ Base URL is required.' });
            return;
        }

        setValidating(true);
        setValidationResult(null);

        try {
            if (apiKey.trim()) {
                const result = await paymentChannelTestApi.test({
                    provider: 'HARAKAPAY',
                    apiKey: apiKey.trim(),
                    apiUrl: apiUrl.trim(),
                });

                const data = (result as any)?.data || result;
                setValidationResult({ success: data.success, message: data.message, statusCode: data.statusCode });

                if (!data.success) {
                    setValidating(false);
                    return;
                }
            }

            setSaving(true);
            await saveProviderChannel({
                provider: 'HARAKAPAY',
                name: 'HarakaPay',
                apiKey: apiKey.trim(),
                apiUrl: apiUrl.trim(),
            });
            setSaved(true);
            setTimeout(() => navigate('/payment-channels'), 2000);

        } catch (err: any) {
            setValidationResult({
                success: false,
                message: `❌ ${err?.message || 'Failed to validate API. Please check your connection.'}`,
            });
        } finally {
            setValidating(false);
            setSaving(false);
        }
    };

    const configuredWebhookUrl = (import.meta.env.VITE_HARAKAPAY_WEBHOOK_URL as string | undefined)?.trim();
    const webhookUrl = configuredWebhookUrl || `${getPublicApiBase()}/api/webhooks/harakapay`;
    const isProcessing = validating || saving;

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
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    ✏️ API Configuration
                </h3>

                {/* Base URL */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        🌐 Base URL <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder={ENV_BASE_URL}
                        value={apiUrl}
                        onChange={e => { setApiUrl(e.target.value); setValidationResult(null); }}
                    />
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Set <code>VITE_HARAKAPAY_API_URL</code> in <code>frontend/.env</code>. Backend uses <code>HARAKAPAY_API_URL</code>. Default: <strong>{ENV_BASE_URL}</strong>
                    </div>
                </div>

                {/* API Key */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>✏️ Accessibility API Key <span style={{ color: '#e11d48' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showKey ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter your HarakaPay API Key"
                            value={apiKey}
                            onChange={e => { setApiKey(e.target.value); setValidationResult(null); }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(p => !p)}
                            style={{
                                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                            }}
                        >
                            {showKey ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
                        </button>
                    </div>
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Get your API key from <strong>HarakaPay Dashboard</strong> {'>'} Developer {'>'} API Keys. Backend env: <code>HARAKAPAY_API_KEY</code>
                    </div>
                </div>

                {/* Webhook Configuration */}
                <h3 style={{ color: '#d97706', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔗 Webhook Configuration
                </h3>
                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        🔗 Webhook URL (Copy this to HarakaPay dashboard)
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        readOnly
                        value={webhookUrl}
                        style={{ background: '#f8f9fa', color: '#6b7280', cursor: 'text' }}
                    />
                </div>
                <div className="form-hint" style={{ marginBottom: 24 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Copy this URL and paste it into your HarakaPay dashboard Webhook/Callback settings. Backend env: <code>HARAKAPAY_WEBHOOK_SECRET</code>
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
                </div>

                {/* Transaction Fees */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    🏦 Transaction Fees (6%)
                </h3>
                <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 20 }}>
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

                {/* Support */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                    📚 Support &amp; Documentation
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

                {/* Validation Result Banner */}
                {validationResult && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: validationResult.success ? '#dcfce7' : '#fff1f2',
                        border: `1px solid ${validationResult.success ? '#a7f3d0' : '#fecdd3'}`,
                        borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16,
                        color: validationResult.success ? '#065f46' : '#9f1239',
                        fontSize: '0.85rem', fontWeight: 500,
                    }}>
                        {validationResult.success
                            ? <CheckCircleIcon style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }} />
                            : <ErrorIcon style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }} />}
                        <div>{validationResult.message}</div>
                    </div>
                )}

                {saved && (
                    <div style={{
                        background: '#dcfce7', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                        padding: '10px 16px', marginBottom: 12, color: '#065f46', fontWeight: 500, fontSize: '0.85rem',
                    }}>
                        ✅ Configuration saved successfully! Redirecting...
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/payment-channels')} disabled={isProcessing}>
                        Cancel
                    </button>
                    <button
                        className="btn"
                        onClick={handleValidateAndSave}
                        disabled={isProcessing}
                        style={{
                            background: '#2563eb', color: '#fff', fontWeight: 600,
                            padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6,
                            opacity: isProcessing ? 0.7 : 1, cursor: isProcessing ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {validating
                            ? <><NetworkCheckIcon style={{ fontSize: 16 }} /> Validating API...</>
                            : saving
                                ? <><SaveIcon fontSize="small" /> Saving...</>
                                : <><NetworkCheckIcon style={{ fontSize: 16 }} /> Validate &amp; Save</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
