import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SmsIcon from '@mui/icons-material/Sms';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PendingIcon from '@mui/icons-material/Pending';
import SyncIcon from '@mui/icons-material/Sync';
import { smsApi } from '../api/client';
import type { SmsMessage } from '../types';
import { formatDateTime } from '../utils/formatters';

type StatusFilter = 'All' | 'Sent' | 'Failed' | 'Pending';

export default function SmsMessages() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<SmsMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [entriesPerPage, setEntriesPerPage] = useState<number | 'All'>(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalMessages, setTotalMessages] = useState(0);
    const [summaries, setSummaries] = useState<any>(null);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {
                page: String(currentPage),
                limit: String(entriesPerPage),
            };
            if (searchTerm) params.search = searchTerm;
            if (statusFilter !== 'All') params.status = statusFilter;

            const res = await smsApi.list(params);
            setMessages((res.data || []) as unknown as SmsMessage[]);
            setTotalMessages(res.total || 0);
            setSummaries((res as any).summaries || null);
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, [searchTerm, statusFilter, currentPage, entriesPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, entriesPerPage]);

    const stats = {
        total: summaries?.total || 0,
        sent: summaries?.sent || 0,
        failed: summaries?.failed || 0,
        pending: summaries?.pending || 0,
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'sent') return { className: 'badge sent', icon: <CheckCircleIcon style={{ fontSize: 12, marginRight: 4 }} />, label: 'Sent' };
        if (s === 'failed') return { className: 'badge failed', icon: <ErrorOutlineIcon style={{ fontSize: 12, marginRight: 4 }} />, label: 'Failed' };
        return { className: 'badge pending', icon: <PendingIcon style={{ fontSize: 12, marginRight: 4 }} />, label: 'Pending' };
    };

    const totalPages = entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalMessages / (entriesPerPage as number)));

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
                        <SmsIcon />
                    </div>
                    <div>
                        <h1 className="page-title">SMS Messages</h1>
                        <p className="page-subtitle">SMS notification history and delivery tracking</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => navigate('/send-bulk-message')}>
                        <SendIcon fontSize="small" /> Send SMS
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                <div className="stat-card blue" onClick={() => setStatusFilter('All')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-label">Total Messages</div>
                    <div className="stat-card-value">{stats.total}</div>
                    <SmsIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card green" onClick={() => setStatusFilter('Sent')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-label">Sent</div>
                    <div className="stat-card-value">{stats.sent}</div>
                    <CheckCircleIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card red" onClick={() => setStatusFilter('Failed')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-label">Failed</div>
                    <div className="stat-card-value">{stats.failed}</div>
                    <ErrorOutlineIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card orange" onClick={() => setStatusFilter('Pending')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-label">Pending</div>
                    <div className="stat-card-value">{stats.pending}</div>
                    <PendingIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
            </div>

            {/* Table Card */}
            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="filter-chips">
                            {(['All', 'Sent', 'Failed', 'Pending'] as StatusFilter[]).map(s => (
                                <button
                                    key={s}
                                    className={`filter-chip ${statusFilter === s ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(s)}
                                >
                                    {s === 'All' ? '📋' : s === 'Sent' ? '✅' : s === 'Failed' ? '❌' : '⏳'} {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search recipient or message..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchMessages()}>
                            <RefreshIcon fontSize="small" />
                        </button>
                    </div>
                </div>

                {/* Show entries */}
                <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-light)' }}>
                    <div className="show-entries">
                        Show{' '}
                        <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(e.target.value === 'All' ? 'All' : Number(e.target.value))}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value="All">All</option>
                        </select>{' '}
                        entries
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Recipient</th>
                                <th>Message</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Sent At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ marginBottom: 10 }}><SyncIcon className="spin" /></div>
                                        Loading messages...
                                    </td>
                                </tr>
                            ) : messages.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <SmsIcon style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }} />
                                        <div>No messages found.</div>
                                    </td>
                                </tr>
                            ) : (
                                messages.map((msg) => {
                                    const badge = getStatusBadge(msg.status);
                                    return (
                                        <tr key={msg.id}>
                                            <td style={{ fontWeight: 500 }}>{msg.recipient}</td>
                                            <td style={{
                                                maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-secondary)',
                                            }}>
                                                {msg.message}
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: msg.type === 'Broadcast' || (msg as any).type === 'BROADCAST' ? '#ede9fe' : '#e0f2fe',
                                                    color: msg.type === 'Broadcast' || (msg as any).type === 'BROADCAST' ? '#7c3aed' : '#0284c7',
                                                }}>
                                                    {msg.type === 'Broadcast' || (msg as any).type === 'BROADCAST' ? 'Broadcast' : 'Individual'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={badge.className} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                    {badge.icon}{badge.label}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                                {formatDateTime(msg.sentAt)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination">
                    <div className="pagination-info">
                        Showing {totalMessages === 0 ? 0 : (currentPage - 1) * (entriesPerPage === 'All' ? totalMessages : (entriesPerPage as number)) + 1}
                        {' '}to {entriesPerPage === 'All' ? totalMessages : Math.min(currentPage * (entriesPerPage as number), totalMessages)}
                        {' '}of {totalMessages} messages
                    </div>
                    <div className="pagination-buttons">
                        <button
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
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
                            style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
