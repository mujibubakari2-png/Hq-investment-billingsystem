import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api';
import { getPublicApiBase } from '../utils/config';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaymentIcon from '@mui/icons-material/Payment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LinkIcon from '@mui/icons-material/Link';

export default function MongikeConfig() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [showWebhookSecret, setShowWebhookSecret] = useState(false);

    useEffect(() => {
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            if (data?.payment_config_mongike) {
                try {
                    const parsed = JSON.parse(data.payment_config_mongike);
                    if (parsed.apiKey) setApiKey(parsed.apiKey);
                    if (parsed.apiSecret) setApiSecret(parsed.apiSecret);
                    if (parsed.webhookSecret) setWebhookSecret(parsed.webhookSecret);
                } catch (e) { }
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.update({
                payment_config_mongike: JSON.stringify({ apiKey, apiSecret, webhookSecret })
            });
            setSaved(true);
            setTimeout(() => navigate('/payment-channels'), 1500);
        } catch (err) {
            console.error(err);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const configuredWebhookUrl = (import.meta.env.VITE_MONGIKE_WEBHOOK_URL as string | undefined)?.trim();
    const webhookUrl = configuredWebhookUrl || `${getPublicApiBase()}/api/webhooks/mongike`;

    return (
        <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 40 }}>
            <style>{`
                .mongike-page {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .mongike-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .mongike-header__left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .mongike-back-btn {
                    background: #f1f5f9;
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--text-secondary);
                    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
                }
                .mongike-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .mongike-subtitle {
                    font-size: 0.88rem;
                    color: var(--text-secondary);
                    margin-top: 4px;
                }
                .mongike-card {
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 18px;
                    padding: 20px;
                    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.05);
                }
                .mongike-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 16px;
                }
                .mongike-section {
                    border: 1px solid #f1f5f9;
                    border-radius: 14px;
                    padding: 16px;
                    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                }
                .mongike-section__title {
                    color: #10b981;
                    font-weight: 700;
                    font-size: 0.95rem;
                    margin: 0 0 14px;
                }
                .mongike-section__title--warning {
                    color: #d97706;
                }
                .mongike-input-wrap {
                    position: relative;
                }
                .mongike-eye-btn {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: var(--text-secondary);
                }
                .mongike-footer {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                .mongike-save-btn {
                    background: #10b981;
                    color: #fff;
                    font-weight: 600;
                    padding: 10px 20px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    opacity: 1;
                    border: none;
                    border-radius: 999px;
                    cursor: pointer;
                }
                .mongike-save-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                @media (max-width: 760px) {
                    .mongike-grid {
                        grid-template-columns: 1fr;
                    }
                    .mongike-card {
                        padding: 16px;
                    }
                    .mongike-footer {
                        justify-content: stretch;
                    }
                    .mongike-save-btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>

            <div className="mongike-page">
                <div className="mongike-header">
                    <div className="mongike-header__left">
                        <button
                            onClick={() => navigate('/payment-channels')}
                            className="mongike-back-btn"
                        >
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
                    <div className="mongike-grid">
                        <div className="mongike-section">
                            <h3 className="mongike-section__title">🔑 API Credentials</h3>

                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>API Key</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter your Mongike API Key"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>API Secret</label>
                                <div className="mongike-input-wrap">
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your Mongike API Secret"
                                        value={apiSecret}
                                        onChange={e => setApiSecret(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="mongike-eye-btn"
                                        onClick={() => setShowSecret((prev) => !prev)}
                                    >
                                        <VisibilityIcon style={{ fontSize: 18 }} />
                                    </button>
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
                                        onChange={e => setWebhookSecret(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="mongike-eye-btn"
                                        onClick={() => setShowWebhookSecret((prev) => !prev)}
                                    >
                                        <VisibilityIcon style={{ fontSize: 18 }} />
                                    </button>
                                </div>
                                <div className="form-hint">
                                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                                    Used to verify webhook requests from Mongike.
                                </div>
                            </div>
                        </div>

                        <div className="mongike-section">
                            <h3 className="mongike-section__title mongike-section__title--warning">🔗 Webhook Configuration</h3>

                            <div className="form-group" style={{ marginBottom: 8 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>
                                    Webhook URL
                                </label>
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

                            <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 12px', borderRadius: 10, fontSize: '0.84rem', lineHeight: 1.5 }}>
                                Make sure the webhook URL is active and the secret matches the value you add in Mongike.
                            </div>
                        </div>
                    </div>

                    <div className="mongike-footer">
                        <button
                            className="mongike-save-btn"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            <SaveIcon fontSize="small" /> {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
