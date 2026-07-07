import { useState, useEffect } from 'react';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { packagesApi, routersApi } from '../api';
import { normalizeApiList } from '../utils/apiResponse';
import type { Package, Router } from '../types';

interface TransactionData {
    username: string;
    planId: string;
    amount: string;
    type: string;
    method: string;
    reference: string;
    router: string;
    notes: string;
}

interface AddTransactionModalProps {
    onClose: () => void;
    onSave?: (data: TransactionData) => void;
}

export default function AddTransactionModal({ onClose, onSave }: AddTransactionModalProps) {
    const [routersList, setRoutersList] = useState<Router[]>([]);
    const [packagesList, setPackagesList] = useState<Package[]>([]);
    const [username, setUsername] = useState('');
    const [planId, setPlanId] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('Manual');
    const [method, setMethod] = useState('Cash');
    const [reference, setReference] = useState('');
    const [router, setRouter] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [loadingData, setLoadingData] = useState(true);

    // ESC key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Proper error handling for parallel data loading
    useEffect(() => {
        Promise.all([
            routersApi.list(),
            packagesApi.list(),
        ]).then(([routers, packages]) => {
            setRoutersList(normalizeApiList<Router>(routers));
            setPackagesList(normalizeApiList<Package>(packages));
        }).catch(() => {
            setLoadError('Failed to load data. Check your network connection.');
        }).finally(() => setLoadingData(false));
    }, []);

    const selectedPlan = packagesList.find(p => p.id === planId);

    const handlePlanChange = (id: string) => {
        setPlanId(id);
        const plan = packagesList.find(p => p.id === id);
        if (plan) setAmount(String(plan.price));
    };

    const handleSave = () => {
        setLoading(true);
        if (onSave) {
            onSave({ username, planId, amount, type, method, reference, router, notes });
        }
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-md" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <AddCircleIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add Transaction</div>
                            <div className="modal-subtitle">Record a new payment transaction</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    {/* Error and loading states */}
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
                        <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-secondary)' }}>Loading...</div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Username <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="Client username or phone" value={username} onChange={e => setUsername(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Router</label>
                            <select className="form-select" value={router} onChange={e => setRouter(e.target.value)}>
                                <option value="">Select Router</option>
                                {routersList.map(r => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Plan Name <span className="required">*</span></label>
                            <select className="form-select" value={planId} onChange={e => handlePlanChange(e.target.value)}>
                                <option value="">Select Plan</option>
                                {packagesList.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount (TZS) <span className="required">*</span></label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                min={1}
                            />
                            {selectedPlan && <div className="form-hint">Plan default: {selectedPlan.price.toLocaleString()} TZS</div>}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Transaction Type</label>
                            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                                <option>Manual</option>
                                <option>Mobile</option>
                                <option>Voucher</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Payment Method</label>
                            <select className="form-select" value={method} onChange={e => setMethod(e.target.value)}>
                                <option>Cash</option>
                                <option>M-Pesa</option>
                                <option>Airtel Money</option>
                                <option>Bank Transfer</option>
                                <option>Voucher</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Reference Number</label>
                        <input type="text" className="form-input" placeholder="Transaction reference or receipt number" value={reference} onChange={e => setReference(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-input" rows={3} placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">
                        Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required
                    </div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !username || !planId}>
                            <CheckIcon fontSize="small" /> {loading ? 'Adding...' : 'Add Transaction'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
