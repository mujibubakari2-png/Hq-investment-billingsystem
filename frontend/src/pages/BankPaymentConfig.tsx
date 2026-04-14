import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api/client';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import SaveIcon from '@mui/icons-material/Save';

const commonBanks = [
    { name: 'KCB Bank', paybill: '522522', color: '#16a34a' },
    { name: 'Equity Bank', paybill: '247247', color: '#6366f1' },
    { name: 'Coop Bank', paybill: '400200', color: '#16a34a' },
    { name: 'MCBR Bank', paybill: '320320', color: '#d97706' },
];

export default function BankPaymentConfig() {
    const navigate = useNavigate();
    const [paybillNumber, setPaybillNumber] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            if (data?.payment_config_bank) {
                try {
                    const parsed = JSON.parse(data.payment_config_bank);
                    if (parsed.paybillNumber) setPaybillNumber(parsed.paybillNumber);
                    if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
                } catch (e) {}
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.update({
                payment_config_bank: JSON.stringify({ paybillNumber, accountNumber })
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
            {/* Green Header */}
            <div style={{
                background: '#16a34a', borderRadius: 'var(--radius-md)',
                padding: '16px 24px', color: '#fff', marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <AccountBalanceIcon style={{ fontSize: 28 }} />
                <div>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Bank Payment Configuration</h1>
                    <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: 0 }}>Configure your bank deposit payment gateway settings</p>
                </div>
            </div>

            {/* Bank Payment Gateway info */}
            <div style={{
                background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
                <InfoOutlinedIcon style={{ fontSize: 16, color: '#16a34a', marginTop: 2 }} />
                <div style={{ fontSize: '0.82rem', color: '#065f46' }}>
                    <strong>Bank Payment Gateway</strong><br />
                    Configure your bank or SACCO details to enable direct deposit payments. This allows customers to make payments directly to your bank account or till number.
                </div>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                {/* Bank Account Details */}
                <h3 style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
                    🏦 Bank Account Details
                </h3>

                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        💳 Bank Paybill Number <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 522522, 400200"
                        value={paybillNumber}
                        onChange={e => setPaybillNumber(e.target.value)}
                    />
                    <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <InfoOutlinedIcon style={{ fontSize: 12 }} />
                        Enter the Bank or SACCO paybill number for payment processing. Common example: KCB (522522), Equity (247247)
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        🏦 Bank Account Number <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 1114045808123"
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                    />
                    <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <InfoOutlinedIcon style={{ fontSize: 12 }} />
                        Enter your bank account number or till number where payments will be deposited
                    </div>
                </div>

                {/* Security Notice */}
                <div style={{
                    background: '#fefce8', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px', marginBottom: 20,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#92400e', marginBottom: 6 }}>
                        <SecurityIcon style={{ fontSize: 16 }} /> Security Notice
                    </div>
                    <ul style={{ fontSize: '0.78rem', color: '#78350f', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                        <li>Ensure your bank account details are correct to avoid payment issues</li>
                        <li>Keep your account information secure and update it regularly</li>
                    </ul>
                </div>

                {/* Info note */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                    Changes will take effect immediately after saving.
                </div>

                {saved && (
                    <div style={{
                        background: '#dcfce7', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)',
                        padding: '10px 16px', marginBottom: 12, color: '#065f46', fontWeight: 500, fontSize: '0.85rem',
                    }}>
                        ✅ Configuration saved successfully! Redirecting...
                    </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ fontWeight: 500 }} onClick={() => navigate('/payment-channels')}>
                        + Cancel
                    </button>
                    <button className="btn" onClick={handleSave} disabled={saving} style={{
                        background: '#0ea5e9', color: '#fff', fontWeight: 600,
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                        <SaveIcon fontSize="small" /> {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {/* Common Bank Paybill Numbers */}
            <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>Common Bank Paybill Numbers</h3>
                <div className="grid-4 gap-12">
                    {commonBanks.map(bank => (
                        <div key={bank.paybill} style={{
                            padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-light)', background: '#fff',
                            cursor: 'pointer',
                        }} onClick={() => setPaybillNumber(bank.paybill)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                    width: 8, height: 8, borderRadius: '50%', background: bank.color,
                                }} />
                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{bank.name}</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: 2 }}>
                                {bank.paybill}
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                    <InfoOutlinedIcon style={{ fontSize: 12 }} />
                    These are common paybill numbers. Contact your bank for the correct paybill number if yours is not listed.
                </div>
            </div>
        </div>
    );
}
