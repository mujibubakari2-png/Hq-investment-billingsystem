import { useState, useEffect } from 'react';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import { transactionsApi, vouchersApi, settingsApi } from '../api/client';
import type { Transaction } from '../types';
import AddTransactionModal from '../modals/AddTransactionModal';
import ViewTransactionModal from '../modals/ViewTransactionModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import { formatDateTime, toTimestamp } from '../utils/formatters';

export default function AllTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [methodFilter, setMethodFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [viewTransaction, setViewTransaction] = useState<Transaction | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [availableMethods, setAvailableMethods] = useState<string[]>([]);

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
            const [txRes, vRes, settingsRes] = await Promise.all([
                transactionsApi.list(),
                vouchersApi.list(),
                settingsApi.get()
            ]);

            // Parse settings to get active gateways
            const data = (settingsRes as any).data || settingsRes;
            let activeGws: string[] = [];
            if (data?.paymentGateways) {
                try {
                    const parsed = JSON.parse(data.paymentGateways);
                    if (Array.isArray(parsed)) {
                        activeGws = parsed.filter(g => g.enabled).map(g => g.name);
                    }
                } catch (e) { }
            }
            setAvailableMethods(activeGws);

            const txs = (txRes.data || []) as unknown as Transaction[];
            const vs = (vRes.data || []) as any[];

            // Map vouchers into Transaction shape
            const mappedVouchers: Transaction[] = vs.map(v => ({
                id: v.id,
                user: v.usedBy || v.createdBy || 'Unassigned',
                planName: v.plan || 'Voucher',
                amount: 0, 
                type: 'Voucher',
                method: 'voucher',
                status: v.status === 'Used' ? 'Completed' : (v.status === 'Unused' ? 'Pending' : v.status),
                date: v.createdAt || null,
                timestamp: v.timestamp || toTimestamp(v.createdAt),
                expiryDate: v.usedAt || null,
                reference: v.code
            }));

            // Filter out transactions that aren't from activated payment channels (or manual/vouchers)
            // User requested: "all vouchers and all transaction which payed from any payment channel which is configured and activated"
            let combined = [...txs, ...mappedVouchers];

            // Clean up old transactions using disabled methods if specifically needed. 
            // We'll trust that the user wants everything from the active gateways + manual + vouchers.
            const validMethodsUpper = [...activeGws.map(g => g.toUpperCase()), 'VOUCHER', 'MANUAL'];
            combined = combined.filter(tx => {
                if (tx.method) {
                    return validMethodsUpper.includes(tx.method.toUpperCase()) || 
                           validMethodsUpper.some(m => tx.method.toUpperCase().includes(m));
                }
                return true;
            });

            // Sort newest first logically and perfectly deterministically!
            combined.sort((a: any, b: any) => {
                const timeA = typeof a.timestamp === 'number' && a.timestamp > 0 ? a.timestamp : toTimestamp(a.date);
                const timeB = typeof b.timestamp === 'number' && b.timestamp > 0 ? b.timestamp : toTimestamp(b.date);
                return (timeB || 0) - (timeA || 0);
            });

            setTransactions(combined);
        } catch (err) { console.error('Failed to load transactions:', err); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchTransactions(); }, []);

    const filtered = transactions.filter(tx => {
        const matchSearch = (tx.user || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (tx.planName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (tx.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchMethod = methodFilter === 'All' || (tx.method || '').toLowerCase() === methodFilter.toLowerCase();
        const matchStatus = statusFilter === 'All' || tx.status === statusFilter;
        return matchSearch && matchMethod && matchStatus;
    });

    const [entriesPerPage, setEntriesPerPage] = useState<number | 'All'>(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Reset page to 1 if filters change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, methodFilter, statusFilter, entriesPerPage]);

    const totalRevenue = transactions.filter(tx => tx.status === 'Completed').reduce((s, tx) => s + tx.amount, 0);

    // Pagination calculations
    const totalPages = entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(filtered.length / entriesPerPage));
    const paginatedTxs = entriesPerPage === 'All' 
        ? filtered 
        : filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

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
            <div className="grid-3 gap-16" style={{ marginBottom: 24 }}>
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
                            Show 
                            <select 
                                value={entriesPerPage} 
                                onChange={e => setEntriesPerPage(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="All">All</option>
                            </select> entries
                        </div>
                        <select className="select-field" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                            <option value="All">All Methods</option>
                            <option value="voucher">Voucher</option>
                            {availableMethods.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
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
                            ) : paginatedTxs.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No transactions found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedTxs.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ fontWeight: 500 }}>{tx.user}</td>
                                        <td>{tx.planName || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{tx.amount.toLocaleString()} TZS</td>
                                        <td>
                                            <span className={`badge ${tx.type === 'Mobile' ? 'hotspot' : tx.type === 'Voucher' ? 'pppoe' : 'inactive'}`}>
                                                {tx.type || 'Manual'}
                                            </span>
                                        </td>
                                        <td>{formatDateTime(tx.date)}</td>
                                        <td>{tx.expiryDate ? formatDateTime(tx.expiryDate) : '—'}</td>
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
                    <div className="pagination-info">
                        Showing {filtered.length === 0 ? 0 : (currentPage - 1) * (entriesPerPage === 'All' ? filtered.length : entriesPerPage) + 1} to {entriesPerPage === 'All' ? filtered.length : Math.min(currentPage * entriesPerPage, filtered.length)} of {filtered.length} entries
                    </div>
                    <div className="pagination-buttons">
                        <button 
                            className="pagination-btn" 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Previous
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        ))}
                        
                        <button 
                            className="pagination-btn" 
                            disabled={currentPage === totalPages} 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
