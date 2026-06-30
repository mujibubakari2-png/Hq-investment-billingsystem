import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentChannelTestApi } from '../api';
import { loadProviderChannel, saveProviderChannel } from '../utils/paymentChannelConfig';
import { getPublicApiBase } from '../utils/config';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';

const ENV_BASE_URL = (import.meta.env.VITE_ZENOPAY_API_URL as string | undefined)?.trim() || '';

export default function ZenoPayConfig() {
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
        loadProviderChannel('ZENOPAY').then((channel: any) => {
            if (!channel) return;
            setHasSavedApiKey(!!channel.hasApiKey);
            if (channel.config?.apiUrl) setApiUrl(channel.config.apiUrl);
        }).catch(console.error);
    }, []);

    /** Step 1: Validate — calls backend which makes a real HTTP request to ZenoPay */
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
                provider: 'ZENOPAY',
                apiKey: apiKey.trim(),
                apiUrl: apiUrl.trim(),
                });

                const data = (result as any)?.data || result;
                setValidationResult({ success: data.success, message: data.message, statusCode: data.statusCode });

                if (!data.success) {
                // Stop here — do not save if API is unreachable/invalid
                setValidating(false);
                return;
                }
            }

            // Step 2: Validation passed — now save
            setSaving(true);
            await saveProviderChannel({
                provider: 'ZENOPAY',
                name: 'ZenoPay',
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

    const configuredWebhookUrl = (import.meta.env.VITE_ZENOPAY_WEBHOOK_URL as string | undefined)?.trim();
    const webhookUrl = configuredWebhookUrl || `${getPublicApiBase()}/api/webhooks/zenopay`;
    const isProcessing = validating || saving;

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
                        Set <code>VITE_ZENOPAY_API_URL</code> in your <code>frontend/.env</code> to lock this value. Current env default: <strong>{ENV_BASE_URL}</strong>
                    </div>
                </div>

                {/* API Key */}
                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>✏️ ZenoPay API Key <span style={{ color: '#e11d48' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showKey ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter your ZenoPay API key"
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
                </div>
                <div className="form-hint" style={{ marginBottom: 24 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Get your API key from ZenoPay dashboard. Also set <code>ZENOPAY_API_KEY</code> in <code>backend/.env</code>.
                </div>

                {/* Webhook Configuration */}
                <h3 style={{ color: '#d97706', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔗 Webhook Configuration
                </h3>
                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        🔗 Webhook URL (Copy this to ZenoPay dashboard)
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
                            readOnly
                            value={webhookUrl}
                            style={{ paddingLeft: 34, background: '#f8f9fa', color: '#6b7280', cursor: 'text' }}
                        />
                    </div>
                </div>
                <div className="form-hint" style={{ marginBottom: 24 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Copy this URL and paste it into your ZenoPay dashboard Webhook settings. Set <code>ZENOPAY_WEBHOOK_SECRET</code> in backend/.env.
                </div>

                {/* Integration Info */}
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
                        Backend env: <code>ZENOPAY_API_URL</code> · <code>ZENOPAY_API_KEY</code> · <code>ZENOPAY_WEBHOOK_SECRET</code>
                    </div>
                </div>

                {/* Supported Networks */}
                <h3 style={{ color: '#d97706', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
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
                            background: '#e11d48', color: '#fff', fontWeight: 600,
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
