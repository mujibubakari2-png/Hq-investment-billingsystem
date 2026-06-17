import { useState } from 'react';
import PaymentIcon from '@mui/icons-material/Payment';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { paymentChannelsApi } from '../api/financeApi';

interface AddPaymentChannelModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

export default function AddPaymentChannelModal({ onClose, onSave }: AddPaymentChannelModalProps) {
    const [name, setName] = useState('');
    const [provider, setProvider] = useState('PALMPESA');
    const [accountNumber, setAccountNumber] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [environment, setEnvironment] = useState<'sandbox' | 'live'>('sandbox');
    const [active, setActive] = useState(true);
    // MOD-001: Add proper loading and error state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const showApiFields = ['PALMPESA', 'ZENOPAY', 'HARAKAPAY', 'MONGIKE'].includes(provider);

    // MOD-001 FIX: handleSave now calls the API directly with loading/error state.
    // Previously it just called onSave() with raw form data and closed immediately
    // without making any network request — credentials were silently discarded.
    const handleSave = async () => {
        if (!name || !provider) return;
        setLoading(true);
        setError('');
        try {
            await paymentChannelsApi.create({
                name,
                provider,
                accountNumber: accountNumber || null,
                apiKey: apiKey || null,
                apiSecret: apiSecret || null,
                webhookSecret: webhookSecret || null,
                environment,
                status: active ? 'ACTIVE' : 'INACTIVE',
            });
            onSave?.({});
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to add payment channel');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--cyan-light)', color: 'var(--cyan)' }}>
                            <PaymentIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add Payment Channel</div>
                            <div className="modal-subtitle">Configure a new payment method</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    {/* Error display */}
                    {error && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                            borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', fontWeight: 500,
                            border: '1px solid #fecaca',
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Channel Name <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="e.g., PalmPesa Main" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Provider <span className="required">*</span></label>
                            <select className="form-select" value={provider} onChange={e => setProvider(e.target.value)}>
                                <option value="PALMPESA">PalmPesa</option>
                                <option value="ZENOPAY">ZenoPay</option>
                                <option value="HARAKAPAY">HarakaPay</option>
                                <option value="MONGIKE">Mongike</option>
                                <option value="CASH">Cash</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Account Number / Paybill</label>
                            <input type="text" className="form-input" placeholder="Business number or account reference" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Environment</label>
                            <select className="form-select" value={environment} onChange={e => setEnvironment(e.target.value as 'sandbox' | 'live')}>
                                <option value="sandbox">Sandbox (Test)</option>
                                <option value="live">Live (Production)</option>
                            </select>
                        </div>
                    </div>

                    {showApiFields && (
                        <>
                            <div className="form-group">
                                <label className="form-label">API Key</label>
                                <input type="password" className="form-input" placeholder="Payment gateway API key" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="new-password" />
                                <div className="form-hint">From your payment provider dashboard — stored encrypted</div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">API Secret</label>
                                    <input type="password" className="form-input" placeholder="API secret key" value={apiSecret} onChange={e => setApiSecret(e.target.value)} autoComplete="new-password" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Webhook Secret <span className="required">*</span></label>
                                    <input type="password" className="form-input" placeholder="Required to verify payment callbacks" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} autoComplete="new-password" />
                                    <div className="form-hint">Required — webhooks rejected without this</div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <div className="toggle" onClick={() => setActive(!active)}>
                            <div className={`toggle-switch ${active ? 'active' : ''}`} />
                            <span className="toggle-label">Channel Active</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required</div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !name || !provider}>
                            <CheckIcon fontSize="small" /> {loading ? 'Saving...' : 'Add Channel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
