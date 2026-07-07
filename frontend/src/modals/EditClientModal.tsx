import { useState, useEffect } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { routersApi, packagesApi, clientsApi } from '../api';
import { normalizeApiList } from '../utils/apiResponse';
import type { Client, Router, Package } from '../types';
import { getPhoneError } from '../utils/validators';

interface EditClientModalProps {
    client: Client;
    onClose: () => void;
    onSave?: (updated: Client) => void;
}

export default function EditClientModal({ client, onClose, onSave }: EditClientModalProps) {
    const [fullName, setFullName] = useState(client.fullName);
    const [email, setEmail] = useState(client.email || '');
    const [phone, setPhone] = useState(client.phone);
    const [accountType, setAccountType] = useState(client.accountType);
    const [status, setStatus] = useState(client.status);
    const [router, setRouter] = useState(client.router || '');
    const [plan, setPlan] = useState(client.plan || '');
    const [routersList, setRoutersList] = useState<Router[]>([]);
    const [packagesList, setPackagesList] = useState<Package[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadError, setLoadError] = useState('');
    const [loadingData, setLoadingData] = useState(true);

    // ESC key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Proper error handling for data loading
    useEffect(() => {
        Promise.all([
            routersApi.list(),
            packagesApi.list(),
        ]).then(([routersResponse, packagesResponse]) => {
            setRoutersList(normalizeApiList<Router>(routersResponse));
            setPackagesList(normalizeApiList<Package>(packagesResponse));
        }).catch(() => {
            setLoadError('Failed to load data. Check your network connection.');
        }).finally(() => setLoadingData(false));
    }, []);

    const phoneError = getPhoneError(phone);

    // Unsaved changes warning
    const isDirty = fullName !== client.fullName || email !== (client.email || '') || phone !== client.phone
        || accountType !== client.accountType || status !== client.status;

    const handleClose = () => {
        if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) return;
        onClose();
    };

    // Send data directly to API instead of relying on parent callback
    const handleSave = async () => {
        setLoading(true);
        setError('');
        try {
            await clientsApi.update(client.id, {
                fullName,
                email: email || undefined,
                phone: phone || undefined,
                accountType: accountType.toUpperCase(),
                status: status.toUpperCase(),
            });
            onSave?.({ ...client, fullName, email, phone, accountType, status, router, plan });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                            <EditIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Edit Client</div>
                            <div className="modal-subtitle">Update client information – @{client.username}</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={handleClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    {/* Error display */}
                    {error && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                            borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', fontWeight: 500,
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}
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
                            <label className="form-label">Username</label>
                            <input type="text" className="form-input" value={client.username} readOnly style={{ opacity: 0.6 }} />
                            <div className="form-hint">Cannot be changed</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-input" placeholder="client@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
                            {/* Phone validation */}
                            {phoneError && <div className="form-hint" style={{ color: 'var(--danger)' }}>{phoneError}</div>}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Account Type</label>
                            <select className="form-select" value={accountType} onChange={e => setAccountType(e.target.value as 'Personal' | 'Business')}>
                                <option>Personal</option>
                                <option>Business</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={status} onChange={e => setStatus(e.target.value as Client['status'])}>
                                <option>Active</option>
                                <option>Inactive</option>
                                <option>Suspended</option>
                                <option>Banned</option>
                                <option>Disabled</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Router</label>
                            <select className="form-select" value={router} onChange={e => setRouter(e.target.value)}>
                                <option value="">No Router</option>
                                {routersList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Plan</label>
                            <select className="form-select" value={plan} onChange={e => setPlan(e.target.value)}>
                                <option value="">No Plan</option>
                                {packagesList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !!phoneError}>
                            <CheckIcon fontSize="small" /> {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
