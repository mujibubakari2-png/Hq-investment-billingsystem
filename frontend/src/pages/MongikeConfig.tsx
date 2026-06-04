import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api';
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

    return (
        <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button 
                    onClick={() => navigate('/payment-channels')}
                    style={{
                        background: '#f1f5f9', border: 'none', width: 36, height: 36,
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)'
                    }}
                >
                    <ArrowBackIcon fontSize="small" />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PaymentIcon style={{ color: '#10b981' }} />
                        Mongike Integration
                    </h1>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Configure your Mongike payment gateway credentials
                    </div>
                </div>
            </div>

            {saved && (
                <div style={{
                    background: '#dcfce7', color: '#166534', padding: '12px 16px',
                    borderRadius: 'var(--radius-md)', marginBottom: 24, fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500
                }}>
                    <SaveIcon fontSize="small" /> Settings saved successfully!
                </div>
            )}

            <div className="card">
                <h3 style={{ color: '#10b981', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔑 API Credentials
                </h3>
                
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>API Key</label>
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Enter your Mongike API Key"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>API Secret</label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="password" 
                            className="form-input" 
                            placeholder="Enter your Mongike API Secret"
                            value={apiSecret}
                            onChange={e => setApiSecret(e.target.value)}
                        />
                        <button style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'
                        }}>
                            <VisibilityIcon style={{ fontSize: 18 }} />
                        </button>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Webhook Secret (Optional)</label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="password" 
                            className="form-input" 
                            placeholder="Enter your Webhook Secret"
                            value={webhookSecret}
                            onChange={e => setWebhookSecret(e.target.value)}
                        />
                    </div>
                    <div className="form-hint">
                        <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                        Used to verify the authenticity of webhook requests from Mongike.
                    </div>
                </div>

                {/* Webhook Configuration */}
                <h3 style={{ color: '#d97706', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🔗 Webhook Configuration
                </h3>

                <div className="form-group" style={{ marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        🔗 Webhook URL (Copy this to Mongike dashboard)
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
                            value={`${window.location.origin}/api/webhooks/mongike`}
                            style={{ paddingLeft: 34, background: '#f8f9fa', color: '#6b7280', cursor: 'text' }}
                        />
                    </div>
                </div>
                <div className="form-hint" style={{ marginBottom: 24 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12, marginRight: 4 }} />
                    Copy this URL and paste it into your Mongike dashboard Webhook settings. The backend will automatically handle payment verifications via this route.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
                    <button 
                        className="btn" 
                        onClick={handleSave}
                        disabled={saving}
                        style={{ 
                            background: '#10b981', color: '#fff', fontWeight: 600, padding: '10px 24px',
                            display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 
                        }}
                    >
                        <SaveIcon fontSize="small" /> {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}
