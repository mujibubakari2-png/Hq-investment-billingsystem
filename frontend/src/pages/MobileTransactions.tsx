import { useState, useEffect } from 'react';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BlockIcon from '@mui/icons-material/Block';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { mobileTransactionsApi } from '../api/client';
import { formatDateTime } from '../utils/formatters';

export default function MobileTransactions() {
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState<number | 'All'>(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [totalTxs, setTotalTxs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState<any>(null);

    const [statusFilter, setStatusFilter] = useState('All');
    const [methodFilter, setMethodFilter] = useState('All');
    const [activeGateways, setActiveGateways] = useState<string[]>([]);

    const handleExport = () => {
        if (transactions.length === 0) return alert('No transactions to export!');

        const headers = ['User', 'Plan', 'Amount', 'Method', 'Transaction ID', 'Status', 'Date'];
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(',') + '\n'
            + transactions.map((t: any) =>
                `${t.user},${t.planName || ''},${t.amount},${t.method || ''},${t.reference || t.transactionId || ''},${t.status},${formatDateTime(t.date)}`
            ).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `payment-channel-transactions-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            // Fetch dynamically aggregated stats & fully paginated/filtered data natively from backend
            const res = await mobileTransactionsApi.list({
                search: searchTerm,
                status: statusFilter,
                method: methodFilter,
                page: currentPage,
                limit: entriesPerPage
            });
            
            setActiveGateways(res.activeGateways || []);
            setTransactions(res.data || []);
            setTotalTxs(res.total || 0);
            setSummaries(res.summaries || null);
        } catch (err) {
            console.error('Failed to load mobile transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [searchTerm, entriesPerPage, statusFilter, methodFilter, currentPage]);

    // Reset pagination on filter change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, entriesPerPage, statusFilter, methodFilter]);

    const todayTotal = summaries?.today?.total || 0;
    const todayPaid = summaries?.today?.paid || 0;
    const todayRevenue = summaries?.today?.revenue || 0;

    const monthTotal = summaries?.month?.total || 0;
    const monthPaidCount = summaries?.month?.paid || 0;
    const monthUnpaidCount = summaries?.month?.unpaid || 0;
    const monthExpiredCount = summaries?.month?.expired || 0;
    const monthCancelledCount = summaries?.month?.cancelled || 0;
    const monthRevenue = summaries?.month?.revenue || 0;

    const totalPages = entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalTxs / (entriesPerPage as number)));

    return (
        <div>
            {/* Summary Row - pink/red theme */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, marginTop: 4 }}>Period Summaries</h3>
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1px 1fr 1fr 1fr',
                border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginBottom: 16, background: '#fff',
            }}>
                <div style={{ textAlign: 'center', padding: '14px 0', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 6, left: 10, fontSize: '0.65rem', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase', background: '#ffe4e6', padding: '2px 6px', borderRadius: 4 }}>Today</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e11d48', marginTop: 10 }}>{todayTotal}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total transactions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0', marginTop: 10 }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>{todayPaid}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paid transactions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0', marginTop: 10 }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0ea5e9' }}>TSH {todayRevenue.toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue generated</div>
                </div>
                <div style={{ background: '#e5e7eb', width: 1 }} />
                <div style={{ textAlign: 'center', padding: '14px 0', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 6, left: 10, fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>This Month</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 10 }}>{monthTotal}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total transactions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0', marginTop: 10 }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>{monthPaidCount}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paid transactions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0', marginTop: 10 }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0ea5e9' }}>TSH {monthRevenue.toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue generated</div>
                </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>This Month's Breakdown</h3>
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 20, gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #e11d48', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                            <ReceiptLongIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{monthTotal}</div>
                        </div>
                    </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #16a34a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <CheckCircleIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Paid</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{monthPaidCount}</div>
                        </div>
                    </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                            <BlockIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Expired</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{monthExpiredCount}</div>
                        </div>
                    </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #ef4444', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                            <CancelIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Unpaid</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{monthUnpaidCount}</div>
                        </div>
                    </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                            <BlockIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Cancelled</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{monthCancelledCount}</div>
                        </div>
                    </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #16a34a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <AttachMoneyIcon fontSize="small" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a' }}>TSH {monthRevenue.toLocaleString()}</div>
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
                            <PhoneAndroidIcon style={{ color: 'var(--text-secondary)' }} /> Payment Channel Transaction Logs
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Record of all mobile and gateway transactions</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={handleExport} style={{ background: '#e11d48', color: '#fff', fontWeight: 600, fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileDownloadIcon fontSize="small" /> Export CSV
                        </button>
                    </div>
                </div>

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

                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed / Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Failed">Failed / Cancelled</option>
                        </select>

                        <select className="select-field" value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ textTransform: 'capitalize' }}>
                            <option value="All">All Gateways</option>
                            {activeGateways.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
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
                                <th>Amount</th>
                                <th>Transaction ID</th>
                                <th>Method</th>
                                <th>Created</th>
                                <th>Paid</th>
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
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <PhoneAndroidIcon style={{ fontSize: 14, color: '#e11d48' }} />
                                                </div>
                                                <div style={{ fontWeight: 500 }}>{tx.user}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{tx.planName || tx.plan || '—'}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{tx.planId || ''}</div>
                                        </td>
                                        <td style={{ fontWeight: 600, color: '#16a34a' }}>
                                            💰 TSH {(tx.amount || 0).toLocaleString()}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: (tx.transactionId || tx.reference) ? '#6366f1' : 'inherit' }}>
                                            {tx.transactionId || tx.reference || '—'}
                                        </td>
                                        <td style={{ textTransform: 'capitalize' }}>{tx.method || '—'}</td>
                                        <td>{formatDateTime(tx.date)}</td>
                                        <td>{tx.status === 'Paid' || tx.status === 'Completed' ? formatDateTime(tx.date) : '—'}</td>
                                        <td>
                                            <span className={`badge ${tx.status === 'Paid' || tx.status === 'Completed' ? 'active' : tx.status === 'Pending' ? 'expired' : 'suspended'}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    className="btn-icon view"
                                                    title="Copy Transaction ID"
                                                    onClick={() => {
                                                        const ref = tx.transactionId || tx.reference;
                                                        if (ref) {
                                                            navigator.clipboard.writeText(ref);
                                                            alert(`Copied: ${ref}`);
                                                        } else {
                                                            alert('No Transaction ID mapped.');
                                                        }
                                                    }}
                                                >
                                                    <ContentCopyIcon style={{ fontSize: 16 }} />
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
                        Showing {totalTxs === 0 ? 0 : (currentPage - 1) * (entriesPerPage === 'All' ? totalTxs : (entriesPerPage as number)) + 1} to {entriesPerPage === 'All' ? totalTxs : Math.min(currentPage * (entriesPerPage as number), totalTxs)} of {totalTxs} transactions
                    </div>
                    <div className="pagination-buttons">
                        <button
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Prev
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
