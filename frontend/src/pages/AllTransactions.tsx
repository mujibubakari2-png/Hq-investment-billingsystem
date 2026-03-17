import { useState, useEffect } from 'react';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import { transactionsApi } from '../api/client';
import type { Transaction } from '../types';
import AddTransactionModal from '../modals/AddTransactionModal';
import ViewTransactionModal from '../modals/ViewTransactionModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

export default function AllTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [methodFilter, setMethodFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [viewTransaction, setViewTransaction] = useState<Transaction | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

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
            const res = await transactionsApi.list();
            setTransactions((res.data || []) as unknown as Transaction[]);
        } catch (err) { console.error('Failed to load transactions:', err); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchTransactions(); }, []);

    const filtered = transactions.filter(tx => {
        const matchSearch = tx.user.toLowerCase().includes(searchTerm.toLowerCase()) || (tx.planName || '').toLowerCase().includes(searchTerm.toLowerCase()) || tx.reference.toLowerCase().includes(searchTerm.toLowerCase());
        const matchMethod = methodFilter === 'All' || tx.method === methodFilter;
        const matchStatus = statusFilter === 'All' || tx.status === statusFilter;
        return matchSearch && matchMethod && matchStatus;
    });

    const totalRevenue = transactions.filter(tx => tx.status === 'Completed').reduce((s, tx) => s + tx.amount, 0);

    return (
        <div>
            {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} onSave={handleAddTransaction} />}
            {viewTransaction && (
                <ViewTransactionModal
                    transaction={viewTransaction}
                    onClose={() => setViewTransaction(null)}
                />
            )}
            {deleteId && (
                <ConfirmDeleteModal
                    title="Delete Transaction"
                    message="Are you sure you want to delete this transaction record?"
                    confirmLabel="Delete"
                    onClose={() => setDeleteId(null)}
                    onConfirm={async () => {
                        try {
                            await transactionsApi.delete(deleteId);
                            setDeleteId(null);
                            fetchTransactions();
                        } catch (err) {
                            console.error('Failed to delete transaction:', err);
                            alert('Failed to delete transaction.');
                        }
                    }}
                />
            )}

            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <ReceiptLongIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Payments Records</h1>
                        <p className="page-subtitle">Track all payment transactions</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add Transaction
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--secondary)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)', marginTop: 4 }}>{totalRevenue.toLocaleString()} TZS</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--info)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Completed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)', marginTop: 4 }}>{transactions.filter(t => t.status === 'Completed').length}</div>
                </div>
                <div className="card card-body" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pending / Failed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)', marginTop: 4 }}>{transactions.filter(t => t.status !== 'Completed').length}</div>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="show-entries">
                            Show <select><option>10</option><option>25</option><option>50</option></select> entries
                        </div>
                        <select className="select-field" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                            <option value="All">All Methods</option>
                            <option>palmpesa</option>
                            <option>voucher</option>
                            <option>Airtel Money</option>
                            <option>Bank Transfer</option>
                        </select>
                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            <option>Completed</option>
                            <option>Pending</option>
                            <option>Failed</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search payments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Plan Name</th>
                                <th>Amount</th>
                                <th>Type</th>
                                <th>Created Date</th>
                                <th>Expiry Date</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading transactions...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No transactions found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ fontWeight: 500 }}>{tx.user}</td>
                                        <td>{tx.planName || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{tx.amount.toLocaleString()} TZS</td>
                                        <td>
                                            <span className={`badge ${tx.type === 'Mobile' ? 'hotspot' : tx.type === 'Voucher' ? 'pppoe' : 'inactive'}`}>
                                                {tx.type || 'Manual'}
                                            </span>
                                        </td>
                                        <td>{tx.date}</td>
                                        <td>{tx.expiryDate || '—'}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{tx.method}</td>
                                        <td>
                                            <span className={`badge ${tx.status === 'Completed' ? 'active' : tx.status === 'Pending' ? 'expired' : 'suspended'}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon view" title="View" onClick={() => setViewTransaction(tx)}><VisibilityIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => setDeleteId(tx.id)}>
                                                    <DeleteIcon style={{ fontSize: 16 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <div className="pagination-info">Showing 1 to {filtered.length} of {transactions.length} entries</div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Previous</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
