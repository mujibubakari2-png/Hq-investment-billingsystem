import { useState, useEffect } from 'react';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TuneIcon from '@mui/icons-material/Tune';
import PendingIcon from '@mui/icons-material/Pending';
import BlockIcon from '@mui/icons-material/Block';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AddIcon from '@mui/icons-material/Add';
import { transactionsApi } from '../api/client';
import AddTransactionModal from '../modals/AddTransactionModal';

export default function MobileTransactions() {
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(25);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    const handleAddTransaction = async (data: any) => {
        try {
            await transactionsApi.create(data);
            setShowAddModal(false);
            fetchTransactions();
        } catch (err) {
            console.error('Failed to create transaction:', err);
            alert('Failed to create transaction. Please check your inputs.');
        }
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            // using the method filter if there was one, or just fetching all mobile tx
            const res = await transactionsApi.list({ type: 'Mobile' });
            setTransactions((res.data || []) as any[]);
        } catch (err) {
            console.error('Failed to load mobile transactions:', err);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchTransactions();
    }, []);

    const totalTransactions = transactions.length;
    const paidCount = transactions.filter(t => t.status === 'Completed' || t.status === 'Paid').length;
    const unpaidCount = transactions.filter(t => t.status === 'Unpaid').length;
    const pendingCount = transactions.filter(t => t.status === 'Pending').length;
    const cancelledCount = transactions.filter(t => t.status === 'Failed').length;
    const paidAmount = transactions.filter(t => t.status === 'Completed' || t.status === 'Paid').reduce((sum, t) => sum + (t.amount || 0), 0);

    const filtered = transactions.filter(tx =>
        (tx.user || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.planName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.reference || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} onSave={handleAddTransaction} />}
            {/* Summary Row - pink/red theme */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1px 1fr 1fr 1fr',
                border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginBottom: 16, background: '#fff',
            }}>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e11d48' }}>0</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e11d48' }}>0</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paid</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0ea5e9' }}>TSH 0</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue</div>
                </div>
                <div style={{ background: '#e5e7eb', width: 1 }} />
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalTransactions}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{paidCount}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paid</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>TSH {paidAmount.toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue</div>
                </div>
            </div>

            {/* Stat Cards - 6 cards */}
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 16 }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #e11d48' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                            <ReceiptLongIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Total</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{totalTransactions}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <CheckCircleIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Paid</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{paidCount}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                            <PendingIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Ongoing</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{pendingCount + unpaidCount > 6 ? 6 : pendingCount}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                            <CancelIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Unpaid</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{unpaidCount}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #6b7280' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                            <BlockIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Cancelled</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{cancelledCount}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <AttachMoneyIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Revenue</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a' }}>TSH {paidAmount.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Table */}
            <div className="card">
                {/* Table header with title */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', marginBottom: 2 }}>
                            <PhoneAndroidIcon style={{ color: 'var(--text-secondary)' }} /> M-Pesa Transaction Logs
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Record of M-Pesa transactions</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={() => setShowAddModal(true)} style={{ background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AddIcon fontSize="small" /> Add Transaction
                        </button>
                        <button className="btn" style={{ background: '#fff', color: '#e11d48', fontWeight: 600, border: '1px solid #fecdd3', fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <TuneIcon fontSize="small" /> Filters
                        </button>
                        <button className="btn" style={{ background: '#e11d48', color: '#fff', fontWeight: 600, fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileDownloadIcon fontSize="small" /> Export
                        </button>
                    </div>
                </div>

                <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="table-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.85rem' }}>Show</span>
                        <select className="select-field" value={entriesPerPage} onChange={e => setEntriesPerPage(Number(e.target.value))} style={{ width: 70 }}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <span style={{ fontSize: '0.85rem' }}>entries</span>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Plan</th>
                                <th>↕ Amount</th>
                                <th>Transaction ID</th>
                                <th>↕ Method</th>
                                <th>Created</th>
                                <th>↕ Paid</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading mobile transactions...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No mobile transactions found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.slice(0, entriesPerPage).map((tx) => (
                                    <tr key={tx.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <PhoneAndroidIcon style={{ fontSize: 14, color: '#e11d48' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{tx.user}</div>
                                                </div>
                                            </div>
                                        </td>
                                    <td>
                                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{tx.planName || tx.plan || '—'}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{tx.planId || ''}</div>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: '#16a34a' }}>💰 TSH {(tx.amount || 0).toLocaleString()}</span>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: (tx.transactionId || tx.reference) ? '#6366f1' : '#9ca3af' }}>
                                        {tx.transactionId || tx.reference || '—'}
                                    </td>
                                    <td style={{ fontSize: '0.82rem' }}>{tx.method || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{tx.date || tx.created || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{tx.status === 'Paid' || tx.status === 'Completed' ? (tx.date || tx.paid) : '—'}</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 12, fontWeight: 500, fontSize: '0.75rem',
                                            background: (tx.status === 'Paid' || tx.status === 'Completed') ? '#d1fae5' : tx.status === 'Pending' ? '#fef3c7' : '#fef2f2',
                                            color: (tx.status === 'Paid' || tx.status === 'Completed') ? '#065f46' : tx.status === 'Pending' ? '#92400e' : '#b91c1c',
                                        }}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 2 }}
                                                onClick={() => setOpenDropdown(openDropdown === tx.id ? null : tx.id)}
                                            >
                                                1 <ExpandMoreIcon style={{ fontSize: 12 }} />
                                            </button>
                                            {openDropdown === tx.id && (
                                                <div style={{
                                                    position: 'absolute', right: 0, top: '100%', marginTop: 4,
                                                    background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                                    boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: 140, overflow: 'hidden',
                                                }}>
                                                    <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
                                                        onClick={() => setOpenDropdown(null)}>
                                                        <VisibilityIcon style={{ fontSize: 14 }} /> View Details
                                                    </button>
                                                    <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
                                                        onClick={() => setOpenDropdown(null)}>
                                                        <ContentCopyIcon style={{ fontSize: 14 }} /> Copy Txn ID
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <div className="pagination-info">Showing 1 to {Math.min(entriesPerPage, filtered.length)} of {filtered.length} transactions</div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Prev</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">2</button>
                        <button className="pagination-btn">3</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
