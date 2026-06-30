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

const ENV_BASE_URL = (import.meta.env.VITE_PALMPESA_API_URL as string | undefined)?.trim() || '';

export default function PalmPesaConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [apiUrl, setApiUrl] = useState(ENV_BASE_URL);
    const [showToken, setShowToken] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
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
        loadProviderChannel('PALMPESA').then((channel: any) => {
            if (!channel) return;
            setHasSavedApiKey(!!channel.hasApiKey);
            if (channel.hasApiSecret) setApiToken('');
            if (channel.hasWebhookSecret) setSecretKey('');
            if (channel.config?.apiUrl) setApiUrl(channel.config.apiUrl);
        }).catch(console.error);
    }, []);

    const handleValidateAndSave = async () => {
        if (!apiKey.trim() && !hasSavedApiKey) {
            setValidationResult({ success: false, message: '❌ API Account ID is required before saving.' });
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
                    provider: 'PALMPESA',
                    apiKey: apiKey.trim(),
                    apiUrl: apiUrl.trim(),
                    // apiToken used as apiSecret for PalmPesa
                    apiSecret: apiToken.trim() || undefined,
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
                provider: 'PALMPESA',
                name: 'PalmPesa',
                apiKey: apiKey.trim(),
                apiSecret: apiToken.trim(),
                webhookSecret: secretKey.trim(),
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

    const configuredWebhookUrl = (import.meta.env.VITE_PALMPESA_WEBHOOK_URL as string | undefined)?.trim();
    const webhookUrl = configuredWebhookUrl || `${getPublicApiBase()}/api/webhooks/palmpesa`;
    const isProcessing = validating || saving;

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
                        Set <code>VITE_PALMPESA_API_URL</code> in <code>frontend/.env</code>. Backend uses <code>PALMPESA_API_URL</code>. Default: <strong>{ENV_BASE_URL}</strong>
                    </div>
                </div>

                <div className="grid-2 gap-16" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            ✏️ API Account ID <span style={{ color: '#e11d48' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Your PalmPesa Account ID"
                            value={apiKey}
                            onChange={e => { setApiKey(e.target.value); setValidationResult(null); }}
                        />
                        <div className="form-hint">
                            <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                            Your account ID from PalmPesa dashboard
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            🔒 PalmPesa API Token
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showToken ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter PalmPesa API Token"
                                value={apiToken}
                                onChange={e => { setApiToken(e.target.value); setValidationResult(null); }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(p => !p)}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                                }}
                            >
                                {showToken ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
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
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showSecret ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter Secret Key"
                            value={secretKey}
                            onChange={e => { setSecretKey(e.target.value); setValidationResult(null); }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowSecret(p => !p)}
                            style={{
                                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                            }}
                        >
                            {showSecret ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
                        </button>
                    </div>
                </div>
                <div className="form-hint" style={{ marginBottom: 20 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Obtain credentials from PalmPesa. Backend env: <code>PALMPESA_API_KEY</code> · <code>PALMPESA_WEBHOOK_SECRET</code>
                </div>

                {/* URL Configuration */}
                <h3 style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    <LinkIcon style={{ fontSize: 16, marginRight: 4 }} /> URL Configuration
                </h3>
                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>🔗 Webhook / Callback URL</label>
                    <input
                        type="text"
                        className="form-input"
                        readOnly
                        value={webhookUrl}
                        style={{ background: '#f8f9fa', color: '#6b7280', cursor: 'text' }}
                    />
                </div>
                <div style={{
                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px', fontSize: '0.78rem', color: '#065f46', marginBottom: 20,
                }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Copy this Webhook URL and paste it into the PalmPesa dashboard callback settings.
                </div>

                {/* Integration Info */}
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
                </div>

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
                            background: '#16a34a', color: '#fff', fontWeight: 600,
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
