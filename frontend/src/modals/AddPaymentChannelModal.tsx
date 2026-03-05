import { useState } from 'react';
import PaymentIcon from '@mui/icons-material/Payment';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

interface AddPaymentChannelModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

export default function AddPaymentChannelModal({ onClose, onSave }: AddPaymentChannelModalProps) {
    const [name, setName] = useState('');
    const [provider, setProvider] = useState('M-Pesa');
    const [accountNumber, setAccountNumber] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [active, setActive] = useState(true);

    const showApiFields = provider === 'M-Pesa' || provider === 'Airtel Money';

    const handleSave = () => {
        if (onSave) onSave({ name, provider, accountNumber, apiKey, apiSecret, status: active ? 'Active' : 'Inactive' });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
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
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Channel Name <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="e.g., PalmPesa, Cash" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Provider <span className="required">*</span></label>
                            <select className="form-select" value={provider} onChange={e => setProvider(e.target.value)}>
                                <option>M-Pesa</option>
                                <option>Airtel Money</option>
                                <option>Cash</option>
                                <option>Bank Transfer</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Account Number / Paybill</label>
                        <input type="text" className="form-input" placeholder="Business number or account reference" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                    </div>

                    {showApiFields && (
                        <>
                            <div className="form-group">
                                <label className="form-label">API Key</label>
                                <input type="text" className="form-input" placeholder="Payment gateway API key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                                <div className="form-hint">From your payment provider dashboard</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">API Secret</label>
                                <input type="password" className="form-input" placeholder="API secret key" value={apiSecret} onChange={e => setApiSecret(e.target.value)} />
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
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name}>
                            <CheckIcon fontSize="small" /> Add Channel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
