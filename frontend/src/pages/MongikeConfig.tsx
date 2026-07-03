import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentChannelTestApi } from '../api';
import { loadProviderChannel, saveProviderChannel } from '../utils/paymentChannelConfig';
import { getPublicApiBase } from '../utils/config';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaymentIcon from '@mui/icons-material/Payment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';

const ENV_BASE_URL = (import.meta.env.VITE_MONGIKE_API_URL as string | undefined)?.trim() || '';

export default function MongikeConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [apiUrl, setApiUrl] = useState(ENV_BASE_URL);
    const [showSecret, setShowSecret] = useState(false);
    const [showWebhookSecret, setShowWebhookSecret] = useState(false);
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
        loadProviderChannel('MONGIKE').then((channel: any) => {
            if (!channel) return;
            setHasSavedApiKey(!!channel.hasApiKey);
            if (channel.hasApiSecret) setApiSecret('');
            if (channel.hasWebhookSecret) setWebhookSecret('');
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
                    provider: 'MONGIKE',
                    apiKey: apiKey.trim(),
                    apiUrl: apiUrl.trim(),
                    apiSecret: apiSecret.trim() || undefined,
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
                provider: 'MONGIKE',
                name: 'Mongike',
                apiKey: apiKey.trim(),
                apiSecret: apiSecret.trim(),
                webhookSecret: webhookSecret.trim(),
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

    const configuredWebhookUrl = (import.meta.env.VITE_MONGIKE_WEBHOOK_URL as string | undefined)?.trim();
    const webhookUrl = configuredWebhookUrl || `${getPublicApiBase()}/api/webhooks/mongike`;
    const isProcessing = validating || saving;

    return (
        <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 40 }}>
            <style>{`
                .mongike-page { display: flex; flex-direction: column; gap: 16px; }
                .mongike-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
                .mongike-header__left { display: flex; align-items: center; gap: 12px; }
                .mongike-back-btn {
                    background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; color: var(--text-secondary); box-shadow: 0 4px 10px rgba(15,23,42,0.06);
                }
                .mongike-title { font-size: 1.25rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; }
                .mongike-subtitle { font-size: 0.88rem; color: var(--text-secondary); margin-top: 4px; }
                .mongike-card {
                    background: #fff; border: 1px solid #e5e7eb; border-radius: 18px;
                    padding: 20px; box-shadow: 0 12px 32px rgba(15,23,42,0.05);
                }
                .mongike-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
                .mongike-section {
                    border: 1px solid #f1f5f9; border-radius: 14px; padding: 16px;
                    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                }
                .mongike-section__title { color: #10b981; font-weight: 700; font-size: 0.95rem; margin: 0 0 14px; }
                .mongike-section__title--warning { color: #d97706; }
                .mongike-input-wrap { position: relative; }
                .mongike-eye-btn {
                    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
                    background: transparent; border: none; cursor: pointer; color: var(--text-secondary);
                }
                .mongike-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
                .mongike-save-btn {
                    background: #10b981; color: #fff; font-weight: 600; padding: 10px 20px;
                    display: flex; align-items: center; gap: 8px; border: none; border-radius: 999px; cursor: pointer;
                }
                .mongike-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                @media (max-width: 760px) {
                    .mongike-grid { grid-template-columns: 1fr; }
                    .mongike-card { padding: 16px; }
                    .mongike-footer { justify-content: stretch; }
                    .mongike-save-btn { width: 100%; justify-content: center; }
                }
            `}</style>

            <div className="mongike-page">
                <div className="mongike-header">
                    <div className="mongike-header__left">
                        <button onClick={() => navigate('/payment-channels')} className="mongike-back-btn">
                            <ArrowBackIcon fontSize="small" />
                        </button>
                        <div>
                            <h1 className="mongike-title">
                                <PaymentIcon style={{ color: '#10b981' }} />
                                Mongike Integration
                            </h1>
                            <div className="mongike-subtitle">
                                Configure your Mongike payment gateway credentials clearly and safely.
                            </div>
                        </div>
                    </div>
                </div>

                {saved && (
                    <div style={{
                        background: '#dcfce7', color: '#166534', padding: '12px 16px',
                        borderRadius: 'var(--radius-md)', fontSize: '0.9rem',
                        display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500
                    }}>
                        <SaveIcon fontSize="small" /> Settings saved successfully!
                    </div>
                )}

                <div className="mongike-card">
                    {/* Base URL — Full width above the grid */}
                    <div style={{ marginBottom: 16 }}>
                        <h3 className="mongike-section__title" style={{ marginBottom: 10 }}>🌐 API Base URL</h3>
                        <input
                            type="text"
                            className="form-input"
                            placeholder={ENV_BASE_URL}
                            value={apiUrl}
                            onChange={e => { setApiUrl(e.target.value); setValidationResult(null); }}
                        />
                        <div className="form-hint" style={{ marginTop: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                            Set <code>VITE_MONGIKE_API_URL</code> in <code>frontend/.env</code>. Backend uses <code>MONGIKE_API_URL</code>. Default: <strong>{ENV_BASE_URL}</strong>
                        </div>
                    </div>

                    <div className="mongike-grid">
                        <div className="mongike-section">
                            <h3 className="mongike-section__title">🔑 API Credentials</h3>

                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>API Key <span style={{ color: '#e11d48' }}>*</span></label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter your Mongike API Key"
                                    value={apiKey}
                                    onChange={e => { setApiKey(e.target.value); setValidationResult(null); }}
                                />
                                <div className="form-hint">
                                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                                    Backend env: <code>MONGIKE_API_KEY</code>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>API Secret</label>
                                <div className="mongike-input-wrap">
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your Mongike API Secret"
                                        value={apiSecret}
                                        onChange={e => { setApiSecret(e.target.value); setValidationResult(null); }}
                                    />
                                    <button type="button" className="mongike-eye-btn" onClick={() => setShowSecret(p => !p)}>
                                        {showSecret ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
                                    </button>
                                </div>
                                <div className="form-hint">
                                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                                    Backend env: <code>MONGIKE_API_SECRET</code>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Webhook Secret (Optional)</label>
                                <div className="mongike-input-wrap">
                                    <input
                                        type={showWebhookSecret ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your Webhook Secret"
                                        value={webhookSecret}
                                        onChange={e => { setWebhookSecret(e.target.value); setValidationResult(null); }}
                                    />
                                    <button type="button" className="mongike-eye-btn" onClick={() => setShowWebhookSecret(p => !p)}>
                                        {showWebhookSecret ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
                                    </button>
                                </div>
                                <div className="form-hint">
                                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                                    Used to verify webhook requests. Backend env: <code>MONGIKE_WEBHOOK_SECRET</code>
                                </div>
                            </div>
                        </div>

                        <div className="mongike-section">
                            <h3 className="mongike-section__title mongike-section__title--warning">🔗 Webhook Configuration</h3>

                            <div className="form-group" style={{ marginBottom: 8 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Webhook URL</label>
                                <div className="mongike-input-wrap">
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
                            <div className="form-hint" style={{ marginBottom: 16 }}>
                                <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                                Copy this URL into your Mongike dashboard webhook settings. The backend will verify payments automatically.
                            </div>

                            <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 12px', borderRadius: 10, fontSize: '0.84rem', lineHeight: 1.5, marginBottom: 12 }}>
                                Make sure the webhook URL is active and the secret matches the value you add in Mongike.
                            </div>

                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 10, fontSize: '0.82rem', color: '#166534' }}>
                                <strong>Backend .env variables:</strong><br />
                                <code>MONGIKE_API_URL</code> · <code>MONGIKE_API_KEY</code><br />
                                <code>MONGIKE_API_SECRET</code> · <code>MONGIKE_WEBHOOK_SECRET</code>
                            </div>
                        </div>
                    </div>

                    {/* Validation Result Banner */}
                    {validationResult && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            background: validationResult.success ? '#dcfce7' : '#fff1f2',
                            border: `1px solid ${validationResult.success ? '#a7f3d0' : '#fecdd3'}`,
                            borderRadius: 10, padding: '12px 16px', marginTop: 16,
                            color: validationResult.success ? '#065f46' : '#9f1239',
                            fontSize: '0.85rem', fontWeight: 500,
                        }}>
                            {validationResult.success
                                ? <CheckCircleIcon style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }} />
                                : <ErrorIcon style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }} />}
                            <div>{validationResult.message}</div>
                        </div>
                    )}

                    <div className="mongike-footer">
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/payment-channels')}
                            disabled={isProcessing}
                            style={{ borderRadius: 999 }}
                        >
                            Cancel
                        </button>
                        <button
                            className="mongike-save-btn"
                            onClick={handleValidateAndSave}
                            disabled={isProcessing}
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
        </div>
    );
}
