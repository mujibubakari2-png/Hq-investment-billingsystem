import { useState, useEffect } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import SmsIcon from '@mui/icons-material/Sms';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SyncIcon from '@mui/icons-material/Sync';
import BusinessIcon from '@mui/icons-material/Business';
import { settingsApi } from '../api/client';

type TabKey = 'general' | 'sms' | 'whatsapp' | 'email';

export default function SystemSettings() {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('general');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // General settings
    const [companyName, setCompanyName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [currency, setCurrency] = useState('TZS');
    const [timezone, setTimezone] = useState('Africa/Dar_es_Salaam');

    // SMS settings
    const [smsProvider, setSmsProvider] = useState('none');
    const [smsApiKey, setSmsApiKey] = useState('');
    const [smsSecretKey, setSmsSecretKey] = useState('');
    const [smsSenderId, setSmsSenderId] = useState('');

    // WhatsApp settings
    const [waProvider, setWaProvider] = useState('none');
    const [waApiToken, setWaApiToken] = useState('');
    const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
    const [waBusinessId, setWaBusinessId] = useState('');

    // Email settings
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpEncryption, setSmtpEncryption] = useState('tls');
    const [smtpEmail, setSmtpEmail] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [emailFromName, setEmailFromName] = useState('');

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'general', label: 'General', icon: <SettingsIcon style={{ fontSize: 16 }} /> },
        { key: 'sms', label: 'SMS', icon: <SmsIcon style={{ fontSize: 16 }} /> },
        { key: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon style={{ fontSize: 16 }} /> },
        { key: 'email', label: 'Email', icon: <EmailIcon style={{ fontSize: 16 }} /> },
    ];

    // Load all settings on mount
    useEffect(() => {
        setLoading(true);
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            // General
            if (data?.companyName) setCompanyName(data.companyName);
            if (data?.phoneNumber) setPhoneNumber(data.phoneNumber);
            if (data?.currency) setCurrency(data.currency);
            if (data?.timezone) setTimezone(data.timezone);
            // SMS
            if (data?.smsProvider) setSmsProvider(data.smsProvider);
            if (data?.smsApiKey) setSmsApiKey(data.smsApiKey);
            if (data?.smsSecretKey) setSmsSecretKey(data.smsSecretKey);
            if (data?.smsSenderId) setSmsSenderId(data.smsSenderId);
            // WhatsApp
            if (data?.waProvider) setWaProvider(data.waProvider);
            if (data?.waApiToken) setWaApiToken(data.waApiToken);
            if (data?.waPhoneNumberId) setWaPhoneNumberId(data.waPhoneNumberId);
            if (data?.waBusinessId) setWaBusinessId(data.waBusinessId);
            // Email
            if (data?.smtpHost) setSmtpHost(data.smtpHost);
            if (data?.smtpPort) setSmtpPort(data.smtpPort);
            if (data?.smtpEncryption) setSmtpEncryption(data.smtpEncryption);
            if (data?.smtpEmail) setSmtpEmail(data.smtpEmail);
            if (data?.smtpPassword) setSmtpPassword(data.smtpPassword);
            if (data?.emailFromName) setEmailFromName(data.emailFromName);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    // Build save payload based on active tab
    const getPayloadForTab = (): Record<string, string> => {
        switch (activeTab) {
            case 'general':
                return { companyName, phoneNumber, currency, timezone };
            case 'sms':
                return { smsProvider, smsApiKey, smsSecretKey, smsSenderId };
            case 'whatsapp':
                return { waProvider, waApiToken, waPhoneNumberId, waBusinessId };
            case 'email':
                return { smtpHost, smtpPort, smtpEncryption, smtpEmail, smtpPassword, emailFromName };
            default:
                return {};
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setFeedback(null);
        try {
            const payload = getPayloadForTab();
            await settingsApi.update(payload);
            setFeedback({ type: 'success', message: `${tabs.find(t => t.key === activeTab)?.label} settings saved successfully!` });
            window.dispatchEvent(new CustomEvent('settingsUpdated'));
        } catch (err: any) {
            console.error('Failed to save settings:', err);
            setFeedback({ type: 'error', message: err.message || 'Failed to save settings. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    // Auto-dismiss feedback
    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    if (loading) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <SyncIcon className="spin" style={{ fontSize: 32, marginBottom: 12 }} />
                <div>Loading settings...</div>
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                        <SettingsIcon />
                    </div>
                    <div>
                        <h1 className="page-title">System Settings</h1>
                        <p className="page-subtitle">Configure your ISP billing system preferences</p>
                    </div>
                </div>
            </div>

            {/* Feedback */}
            {feedback && (
                <div style={{
                    padding: '12px 16px', marginBottom: 20, borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
                    fontSize: '0.9rem', fontWeight: 500,
                    animation: 'fadeIn 0.3s ease',
                }}>
                    {feedback.type === 'success'
                        ? <CheckCircleIcon style={{ fontSize: 18 }} />
                        : <ErrorIcon style={{ fontSize: 18 }} />
                    }
                    {feedback.message}
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{
                display: 'flex', gap: 0, borderBottom: '2px solid var(--border-light)',
                marginBottom: 24, background: 'var(--bg-card)', borderRadius: '8px 8px 0 0',
                overflow: 'hidden',
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setFeedback(null); }}
                        style={{
                            padding: '12px 24px', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontWeight: activeTab === tab.key ? 700 : 400,
                            color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                            marginBottom: -2, fontSize: '0.95rem', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ General Tab ═══ */}
            {activeTab === 'general' && (
                <div className="card">
                    <div className="card-body" style={{ maxWidth: 700 }}>
                        <div className="form-section-title">
                            <BusinessIcon fontSize="small" /> Company Information
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                Company Name <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                placeholder="Enter your company name"
                            />
                            <div className="form-hint">
                                This name will be displayed in the sidebar, page titles, and reports.
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                Phone Number
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                placeholder="e.g. +255 621 085 215"
                            />
                            <div className="form-hint">
                                Customer support phone number shown on invoices and reports.
                            </div>
                        </div>

                        <div className="form-row" style={{ gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Currency</label>
                                <select
                                    className="form-select"
                                    value={currency}
                                    onChange={e => setCurrency(e.target.value)}
                                >
                                    <option value="TZS">TZS - Tanzanian Shilling</option>
                                    <option value="KES">KES - Kenyan Shilling</option>
                                    <option value="UGX">UGX - Ugandan Shilling</option>
                                    <option value="USD">USD - US Dollar</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Timezone</label>
                                <select
                                    className="form-select"
                                    value={timezone}
                                    onChange={e => setTimezone(e.target.value)}
                                >
                                    <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (EAT)</option>
                                    <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                                    <option value="Africa/Kampala">Africa/Kampala (EAT)</option>
                                    <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                                    <option value="UTC">UTC</option>
                                </select>
                            </div>
                        </div>

                        {/* Logo Preview */}
                        <div style={{ marginTop: 24 }}>
                            <label className="form-label" style={{ marginBottom: 8 }}>Company Branding Preview</label>
                            <div style={{
                                width: 220, height: 60, background: '#1a1a2e',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid var(--border)',
                            }}>
                                <span style={{
                                    color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                    letterSpacing: 1, textAlign: 'center',
                                }}>
                                    {companyName || 'Your Company'}
                                </span>
                            </div>
                        </div>

                        {renderSaveButton()}
                    </div>
                </div>
            )}

            {/* ═══ SMS Tab ═══ */}
            {activeTab === 'sms' && (
                <div className="card">
                    <div className="card-body" style={{ maxWidth: 700 }}>
                        <div className="form-section-title">
                            <SmsIcon fontSize="small" /> SMS Provider Configuration
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                SMS Provider <span className="required">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={smsProvider}
                                onChange={e => setSmsProvider(e.target.value)}
                            >
                                <option value="none">Disabled</option>
                                <option value="beem">Beem Africa</option>
                                <option value="twilio">Twilio</option>
                                <option value="africastalking">Africa's Talking</option>
                            </select>
                            <div className="form-hint">
                                Select the SMS gateway provider for sending messages to subscribers.
                            </div>
                        </div>

                        {smsProvider !== 'none' && (
                            <>
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label className="form-label">
                                        API Key <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={smsApiKey}
                                        onChange={e => setSmsApiKey(e.target.value)}
                                        placeholder="Enter your SMS API key"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label className="form-label">
                                        Secret Key <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={smsSecretKey}
                                        onChange={e => setSmsSecretKey(e.target.value)}
                                        placeholder="Enter your SMS secret key"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label className="form-label">Sender ID</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={smsSenderId}
                                        onChange={e => setSmsSenderId(e.target.value)}
                                        placeholder="e.g. HQ-ISP"
                                    />
                                    <div className="form-hint">
                                        The name that appears as the sender when customers receive SMS.
                                    </div>
                                </div>
                            </>
                        )}

                        {smsProvider === 'none' && (
                            <div style={{
                                padding: '24px', textAlign: 'center',
                                background: 'var(--bg-hover)', borderRadius: 8,
                                color: 'var(--text-muted)', marginBottom: 20,
                            }}>
                                <SmsIcon style={{ fontSize: 40, opacity: 0.4, marginBottom: 8 }} />
                                <div>SMS notifications are currently disabled.</div>
                                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                                    Select a provider above to enable SMS messaging.
                                </div>
                            </div>
                        )}

                        {renderSaveButton()}
                    </div>
                </div>
            )}

            {/* ═══ WhatsApp Tab ═══ */}
            {activeTab === 'whatsapp' && (
                <div className="card">
                    <div className="card-body" style={{ maxWidth: 700 }}>
                        <div className="form-section-title">
                            <WhatsAppIcon fontSize="small" /> WhatsApp API Configuration
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                WhatsApp Provider
                            </label>
                            <select
                                className="form-select"
                                value={waProvider}
                                onChange={e => setWaProvider(e.target.value)}
                            >
                                <option value="none">Disabled</option>
                                <option value="whatsapp-cloud">WhatsApp Cloud API (Meta)</option>
                                <option value="twilio-whatsapp">Twilio WhatsApp</option>
                            </select>
                        </div>

                        {waProvider !== 'none' && (
                            <>
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label className="form-label">
                                        API Token <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={waApiToken}
                                        onChange={e => setWaApiToken(e.target.value)}
                                        placeholder="Enter WhatsApp API token"
                                    />
                                </div>
                                <div className="form-row" style={{ gap: 16 }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">
                                            Phone Number ID <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={waPhoneNumberId}
                                            onChange={e => setWaPhoneNumberId(e.target.value)}
                                            placeholder="Enter phone number ID"
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Business Account ID</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={waBusinessId}
                                            onChange={e => setWaBusinessId(e.target.value)}
                                            placeholder="Enter business account ID"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {waProvider === 'none' && (
                            <div style={{
                                padding: '24px', textAlign: 'center',
                                background: 'var(--bg-hover)', borderRadius: 8,
                                color: 'var(--text-muted)', marginBottom: 20,
                            }}>
                                <WhatsAppIcon style={{ fontSize: 40, opacity: 0.4, marginBottom: 8 }} />
                                <div>WhatsApp notifications are currently disabled.</div>
                                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                                    Select a provider above to enable WhatsApp messaging.
                                </div>
                            </div>
                        )}

                        {renderSaveButton()}
                    </div>
                </div>
            )}

            {/* ═══ Email Tab ═══ */}
            {activeTab === 'email' && (
                <div className="card">
                    <div className="card-body" style={{ maxWidth: 700 }}>
                        <div className="form-section-title">
                            <EmailIcon fontSize="small" /> SMTP Email Configuration
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                SMTP Host <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={smtpHost}
                                onChange={e => setSmtpHost(e.target.value)}
                                placeholder="e.g. smtp.gmail.com"
                            />
                        </div>

                        <div className="form-row" style={{ gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">SMTP Port</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={smtpPort}
                                    onChange={e => setSmtpPort(e.target.value)}
                                    placeholder="587"
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Encryption</label>
                                <select
                                    className="form-select"
                                    value={smtpEncryption}
                                    onChange={e => setSmtpEncryption(e.target.value)}
                                >
                                    <option value="tls">TLS</option>
                                    <option value="ssl">SSL</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                From Name
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={emailFromName}
                                onChange={e => setEmailFromName(e.target.value)}
                                placeholder="e.g. HQ Investment Billing"
                            />
                            <div className="form-hint">
                                The display name that appears in the "From" field of outgoing emails.
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                Email Address <span className="required">*</span>
                            </label>
                            <input
                                type="email"
                                className="form-input"
                                value={smtpEmail}
                                onChange={e => setSmtpEmail(e.target.value)}
                                placeholder="noreply@yourdomain.com"
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">
                                Email Password / App Password <span className="required">*</span>
                            </label>
                            <input
                                type="password"
                                className="form-input"
                                value={smtpPassword}
                                onChange={e => setSmtpPassword(e.target.value)}
                                placeholder="Enter email password or app password"
                            />
                            <div className="form-hint">
                                For Gmail, use an <strong>App Password</strong> generated from your Google Account security settings.
                            </div>
                        </div>

                        {renderSaveButton()}
                    </div>
                </div>
            )}
        </div>
    );

    function renderSaveButton() {
        return (
            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                <button
                    className="btn btn-primary"
                    style={{
                        width: '100%', padding: '12px 0', fontSize: '1rem',
                        fontWeight: 700, borderRadius: 'var(--radius-sm)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: saving ? 0.7 : 1,
                    }}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <><SyncIcon fontSize="small" className="spin" /> Saving...</>
                    ) : (
                        <><SaveIcon fontSize="small" /> Save {tabs.find(t => t.key === activeTab)?.label} Settings</>
                    )}
                </button>
            </div>
        );
    }
}
