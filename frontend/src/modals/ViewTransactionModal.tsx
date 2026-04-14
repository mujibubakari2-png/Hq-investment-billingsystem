import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { Transaction } from '../types';
import { formatDateTime } from '../utils/formatters';

interface ViewTransactionModalProps {
    transaction: Transaction;
    onClose: () => void;
}

export default function ViewTransactionModal({ transaction, onClose }: ViewTransactionModalProps) {
    const handleCopyRef = () => {
        navigator.clipboard.writeText(transaction.reference);
        alert('Reference copied!');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <ReceiptLongIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Transaction Details</div>
                            <div className="modal-subtitle">Ref: {transaction.reference}</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="grid-2 gap-16">
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Username</div>
                            <div style={{ fontWeight: 600 }}>{transaction.user}</div>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Amount</div>
                            <div style={{ fontWeight: 700, color: 'var(--secondary)' }}>{transaction.amount.toLocaleString()} TZS</div>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Plan</div>
                            <div style={{ fontWeight: 500 }}>{transaction.planName || '—'}</div>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Method</div>
                            <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{transaction.method}</div>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Type</div>
                            <span className={`badge ${transaction.type === 'Mobile' ? 'hotspot' : transaction.type === 'Voucher' ? 'pppoe' : 'inactive'}`}>
                                {transaction.type || 'Manual'}
                            </span>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                            <span className={`badge ${transaction.status === 'Completed' ? 'active' : transaction.status === 'Pending' ? 'expired' : 'suspended'}`}>
                                {transaction.status}
                            </span>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Created Date</div>
                            <div style={{ fontWeight: 500 }}>{formatDateTime(transaction.date)}</div>
                        </div>
                        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Expiry Date</div>
                            <div style={{ fontWeight: 500 }}>{transaction.expiryDate ? formatDateTime(transaction.expiryDate) : '—'}</div>
                        </div>
                    </div>

                    <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-secondary, #f8f9fa)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reference</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{transaction.reference}</div>
                        </div>
                        <button className="btn-icon sync" onClick={handleCopyRef} title="Copy Reference">
                            <ContentCopyIcon style={{ fontSize: 16 }} />
                        </button>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-primary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
