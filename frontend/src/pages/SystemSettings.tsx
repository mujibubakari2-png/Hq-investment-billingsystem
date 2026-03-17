import { useState } from 'react';
import { settingsApi } from '../api/client';

export default function SystemSettings() {
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'sms' | 'whatsapp' | 'email'>('general');
    const [companyName, setCompanyName] = useState('HQ INVESTMENT');
    const [phoneNumber, setPhoneNumber] = useState('0621085215');

    const tabs = [
        { key: 'general' as const, label: 'General' },
        { key: 'sms' as const, label: 'SMS' },
        { key: 'whatsapp' as const, label: 'WhatsApp' },
        { key: 'email' as const, label: 'Email' },
    ];

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await settingsApi.update({ companyName, phoneNumber });
            alert('Settings saved successfully!');
        } catch (err) {
            console.error('Failed to save settings:', err);
            alert('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-light)', marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 24px', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontWeight: activeTab === tab.key ? 700 : 400,
                            color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                            marginBottom: -2, fontSize: '0.95rem', transition: 'all 0.2s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div style={{ maxWidth: 700 }}>
                    {/* Application Name */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            Application Name/ Company Name
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                        />
                        <div className="form-hint" style={{ color: 'var(--info)' }}>
                            This Name will be shown on the Title
                        </div>
                    </div>

                    {/* Company Logo */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            Company Logo
                        </label>
                        <div style={{
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <button style={{
                                background: '#f3f4f6', border: '1px solid var(--border)',
                                padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 500,
                            }}>
                                Choose File
                            </button>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No file chosen</span>
                        </div>
                        <div className="form-hint" style={{ color: 'var(--info)' }}>
                            For PDF Reports : Best size 1076 x 200 | uploaded image will be autosize
                        </div>

                        {/* Logo preview */}
                        <div style={{
                            marginTop: 12, width: 200, height: 60,
                            background: '#1a1a2e', borderRadius: 'var(--radius-sm)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', letterSpacing: 1 }}>
                                HQ INVESTMENT
                            </span>
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            Phone Number
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                        />
                    </div>

                    {/* Save Button */}
                    <button
                        className="btn"
                        style={{
                            background: 'var(--primary)', color: '#fff', fontWeight: 700,
                            width: '100%', padding: '12px 0', fontSize: '1rem',
                            borderRadius: 'var(--radius-sm)',
                        }}
                        onClick={handleSaveSettings}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* SMS Tab */}
            {activeTab === 'sms' && (
                <div style={{ maxWidth: 700 }}>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>SMS Provider</label>
                        <select className="form-select" defaultValue="beem">
                            <option value="beem">Beem Africa</option>
                            <option value="twilio">Twilio</option>
                            <option value="none">Disabled</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>SMS API Key</label>
                        <input type="password" className="form-input" defaultValue="**************" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>SMS Secret Key</label>
                        <input type="password" className="form-input" defaultValue="**************" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sender ID</label>
                        <input type="text" className="form-input" defaultValue="HQ-ISP" />
                    </div>
                    <button className="btn" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700, width: '100%', padding: '12px 0', fontSize: '1rem' }} onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && (
                <div style={{ maxWidth: 700 }}>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>WhatsApp API Provider</label>
                        <select className="form-select" defaultValue="none">
                            <option value="none">Disabled</option>
                            <option value="whatsapp-cloud">WhatsApp Cloud API</option>
                            <option value="twilio-whatsapp">Twilio WhatsApp</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>WhatsApp API Token</label>
                        <input type="password" className="form-input" placeholder="Enter API token" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>WhatsApp Phone Number ID</label>
                        <input type="text" className="form-input" placeholder="Enter phone number ID" />
                    </div>
                    <button className="btn" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700, width: '100%', padding: '12px 0', fontSize: '1rem' }} onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
                <div style={{ maxWidth: 700 }}>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>SMTP Host</label>
                        <input type="text" className="form-input" placeholder="smtp.gmail.com" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>SMTP Port</label>
                            <input type="number" className="form-input" defaultValue={587} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Encryption</label>
                            <select className="form-select" defaultValue="tls">
                                <option value="tls">TLS</option>
                                <option value="ssl">SSL</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Email Address</label>
                        <input type="email" className="form-input" placeholder="noreply@yourdomain.com" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Email Password</label>
                        <input type="password" className="form-input" placeholder="Enter email password" />
                    </div>
                    <button className="btn" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700, width: '100%', padding: '12px 0', fontSize: '1rem' }} onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}
        </div>
    );
}
