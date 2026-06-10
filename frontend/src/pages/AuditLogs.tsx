import { useState, useEffect, useCallback } from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface AuditLogEntry {
    id: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    createdAt: string;
    user: {
        id: string;
        fullName?: string | null;
        username: string;
        email: string;
        role: string;
    };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
    CREATE: { bg: '#d1fae5', color: '#065f46' },
    UPDATE: { bg: '#dbeafe', color: '#1d4ed8' },
    DELETE: { bg: '#fee2e2', color: '#991b1b' },
    LOGIN:  { bg: '#fef3c7', color: '#92400e' },
    OTHER:  { bg: '#f3f4f6', color: '#374151' },
};

function getActionColor(action: string) {
    const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().includes(k));
    return ACTION_COLORS[key || 'OTHER'];
}

function formatAction(action: string): string {
    return action.replace(/_/g, ' ');
}

async function fetchAuditLogs(params: {
    page: number;
    limit: number;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
}): Promise<{ data: AuditLogEntry[]; pagination: Pagination }> {
    const sp = new URLSearchParams();
    sp.set('page', String(params.page));
    sp.set('limit', String(params.limit));
    if (params.userId) sp.set('userId', params.userId);
    if (params.action) sp.set('action', params.action);
    if (params.from)   sp.set('from', params.from);
    if (params.to)     sp.set('to', params.to);

    const res = await fetch(`${API_BASE}/audit-logs?${sp}`, { credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export default function AuditLogs() {
    const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading]   = useState(false);
    const [page, setPage]         = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const [showFilters, setShowFilters]   = useState(false);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate]     = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchAuditLogs({
                page,
                limit: 50,
                action: actionFilter || undefined,
                from: fromDate || undefined,
                to: toDate ? toDate + 'T23:59:59Z' : undefined,
            });
            setLogs(result.data);
            setPagination(result.pagination);
        } catch (err) {
            console.error('Failed to load audit logs:', err);
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, fromDate, toDate]);

    useEffect(() => { load(); }, [load]);

    const handlePageChange = (p: number) => setPage(p);

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        Administration ♦ Security &amp; Compliance
                    </div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <AdminPanelSettingsIcon /> Audit Logs
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Track all user activity within your organisation
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowFilters(v => !v)} style={{
                        background: showFilters ? 'var(--primary)' : '#f1f5f9',
                        color: showFilters ? '#fff' : '#374151',
                        border: 'none', borderRadius: 8, padding: '7px 14px',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <FilterListIcon fontSize="small" /> Filters
                    </button>
                    <button onClick={load} disabled={loading} style={{
                        background: '#fff', color: '#e11d48', border: '1px solid #fecdd3',
                        borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <RefreshIcon fontSize="small" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 180px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Action contains</label>
                        <div style={{ position: 'relative' }}>
                            <SearchIcon style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-muted)' }} />
                            <input
                                value={actionFilter}
                                onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                                placeholder="e.g. CREATE, DELETE..."
                                style={{ paddingLeft: 28, width: '100%', padding: '7px 8px 7px 28px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem' }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>From Date</label>
                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                            style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem' }} />
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>To Date</label>
                        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                            style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem' }} />
                    </div>
                    <button onClick={() => { setActionFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                        style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        Clear Filters
                    </button>
                </div>
            )}

            {/* Stats */}
            {pagination && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Showing {logs.length} of <strong>{pagination.total.toLocaleString()}</strong> audit events
                </div>
            )}

            {/* Log Table */}
            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Role</th>
                                <th>Action</th>
                                <th>Resource</th>
                                <th>IP Address</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        Loading audit logs...
                                    </td>
                                </tr>
                            )}
                            {!loading && logs.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        No audit events found. Actions taken by your team will appear here.
                                    </td>
                                </tr>
                            )}
                            {logs.map(log => {
                                const actionStyle = getActionColor(log.action);
                                const isExpanded = expandedId === log.id;
                                return (
                                    <>
                                        <tr key={log.id} style={{ cursor: log.details ? 'pointer' : 'default' }}
                                            onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {new Date(log.createdAt).toLocaleString('en-GB', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                    {log.user.fullName || log.user.username}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                    {log.user.email}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9' }}>
                                                    {log.user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                                                    fontSize: '0.72rem', ...actionStyle,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {formatAction(log.action)}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>
                                                <div style={{ fontWeight: 500 }}>{log.resource}</div>
                                                {log.resourceId && (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                        {log.resourceId.slice(0, 12)}…
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                {log.ipAddress || '—'}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {log.details
                                                    ? <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>{isExpanded ? '▲ Hide' : '▼ View'}</span>
                                                    : '—'}
                                            </td>
                                        </tr>
                                        {isExpanded && log.details && (
                                            <tr key={`${log.id}-detail`}>
                                                <td colSpan={7} style={{ background: '#f8fafc', padding: '12px 16px' }}>
                                                    <pre style={{
                                                        margin: 0, fontSize: '0.75rem', color: '#374151',
                                                        fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                                    }}>
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="pagination">
                        <div className="pagination-info">
                            Page {pagination.page} of {pagination.pages}
                        </div>
                        <div className="pagination-buttons">
                            <button className="pagination-btn" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                                Previous
                            </button>
                            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
                                <button key={p} className={`pagination-btn${p === page ? ' active' : ''}`}
                                    onClick={() => handlePageChange(p)}>
                                    {p}
                                </button>
                            ))}
                            <button className="pagination-btn" disabled={page >= pagination.pages} onClick={() => handlePageChange(page + 1)}>
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
