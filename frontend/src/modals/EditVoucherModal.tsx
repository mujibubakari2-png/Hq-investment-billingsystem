import { useState } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import type { Voucher } from '../types'; // I assume Voucher is exported

interface EditVoucherModalProps {
    voucher: Voucher;
    onClose: () => void;
    onSave: () => void;
}

export default function EditVoucherModal({ voucher, onClose, onSave }: EditVoucherModalProps) {
    const [status, setStatus] = useState(voucher.status || 'Unused');
    const [code, setCode] = useState(voucher.code || '');
    const [customer, setCustomer] = useState(voucher.customer ? voucher.customer.toString() : '');
    const [usedBy, setUsedBy] = useState(voucher.usedBy || '');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);
            // In case vouchersApi doesn't have update natively
            await fetch(`/api/vouchers/${voucher.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ code, status: status.toUpperCase(), customer, usedBy })
            });

            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update voucher');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                            <EditIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Edit Voucher</div>
                            <div className="modal-subtitle">Update voucher details manually</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                            borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', fontWeight: 500,
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Voucher Code</label>
                        <input
                            type="text"
                            className="form-input"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-select" value={status} onChange={e => setStatus(e.target.value as any)}>
                            <option value="Unused">Unused</option>
                            <option value="Used">Used</option>
                            <option value="Expired">Expired</option>
                            <option value="Revoked">Revoked</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Linked Customer ID (Optional)</label>
                        <input
                            type="number"
                            className="form-input"
                            value={customer}
                            onChange={e => setCustomer(e.target.value)}
                            placeholder="e.g. 104"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Used By (Optional)</label>
                        <input
                            type="text"
                            className="form-input"
                            value={usedBy}
                            onChange={e => setUsedBy(e.target.value)}
                            placeholder="e.g. juma@domain"
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
