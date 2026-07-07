import { useState, useEffect } from 'react';
import ExtensionIcon from '@mui/icons-material/Extension';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { packagesApi } from '../api';
import { normalizeApiList } from '../utils/apiResponse';
import type { ExpiredSubscriber, Package } from '../types';
import { formatDate } from '../utils/formatters';

interface ExtendSubscriberModalProps {
    subscriber: ExpiredSubscriber;
    onClose: () => void;
    onSave?: (data: object) => void;
}

export default function ExtendSubscriberModal({ subscriber, onClose, onSave }: ExtendSubscriberModalProps) {
    const [packagesList, setPackagesList] = useState<Package[]>([]);
    const [planId, setPlanId] = useState('');
    const [method, setMethod] = useState('Cash');
    const [reference, setReference] = useState('');
    const [amount, setAmount] = useState('');
    const [loadError, setLoadError] = useState('');
    const [loadingData, setLoadingData] = useState(true);

    // ESC key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Proper error handling for data loading
    useEffect(() => {
        packagesApi.list()
            .then((response) => setPackagesList(normalizeApiList<Package>(response)))
            .catch(() => setLoadError('Failed to load packages. Check your network connection.'))
            .finally(() => setLoadingData(false));
    }, []);

    const selectedPlan = packagesList.find(p => p.id === planId);

    const handlePlanChange = (id: string) => {
        setPlanId(id);
        const plan = packagesList.find(p => p.id === id);
        if (plan) setAmount(String(plan.price));
    };

    const handleSave = () => {
        if (onSave) onSave({ subscriber: subscriber.id, planId, method, reference, amount });
        onClose();
    };

    const filteredPackages = packagesList.filter(p => p.type === subscriber.type);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
                            <ExtensionIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Extend Subscription</div>
                            <div className="modal-subtitle">Renew service for {subscriber.username}</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    {/* Show loading and error states */}
                    {loadError && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                            borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', fontWeight: 500,
                            border: '1px solid #fecaca'
                        }}>
                            {loadError}
                        </div>
                    )}
                    {loadingData && (
                        <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-secondary)' }}>Loading packages...</div>
                    )}

                    <div style={{ padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Username</span>
                            <strong>{subscriber.username}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Current Plan</span>
                            <strong>{subscriber.plan}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Expired</span>
                            <strong style={{ color: 'var(--danger)' }}>{formatDate(subscriber.expiredDate)}</strong>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">New Plan <span className="required">*</span></label>
                        <select className="form-select" value={planId} onChange={e => handlePlanChange(e.target.value)}>
                            <option value="">Select Plan</option>
                            {filteredPackages.map(p => (
                                <option key={p.id} value={p.id}>{p.name} – {p.price.toLocaleString()} TZS / {p.validity}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Amount (TZS)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                min={1}
                            />
                            {/* Show warning when amount is invalid */}
                            {amount && Number(amount) <= 0 && (
                                <div className="form-hint" style={{ color: 'var(--danger)' }}>Amount must be greater than 0</div>
                            )}
                            {selectedPlan && <div className="form-hint">Plan price: {selectedPlan.price.toLocaleString()} TZS</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Payment Method</label>
                            <select className="form-select" value={method} onChange={e => setMethod(e.target.value)}>
                                <option>Cash</option>
                                <option>M-Pesa</option>
                                <option>Airtel Money</option>
                                <option>Voucher</option>
                                <option>Bank Transfer</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Reference / Voucher Code</label>
                        <input type="text" className="form-input" placeholder="Payment reference or voucher code" value={reference} onChange={e => setReference(e.target.value)} />
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-success" onClick={handleSave} disabled={!planId || Number(amount) <= 0}>
                            <CheckIcon fontSize="small" /> Extend Subscription
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
