import { useState, useEffect, useCallback } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import WifiIcon from '@mui/icons-material/Wifi';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CellTowerIcon from '@mui/icons-material/CellTower';
import SyncIcon from '@mui/icons-material/Sync';

import { useNavigate } from 'react-router-dom';
import { activeSubscribersApi, subscriptionsApi, routersApi } from '../api/client';
import { formatDate } from '../utils/formatters';
import type { ActiveSubscriber, Router } from '../types';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

interface SubscriptionSummaries {
    totalActive: number;
    online: number;
    offline: number;
}

export default function ActiveSubscribers() {
    const navigate = useNavigate();
    const [subs, setSubs] = useState<ActiveSubscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Filters & Pagination
    const [activeTab, setActiveTab] = useState<'All' | 'PPPoE' | 'Hotspot'>('All');
    const [onlineFilter, setOnlineFilter] = useState<'All' | 'Online' | 'Offline'>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [routerFilter, setRouterFilter] = useState('All');
    const [routersList, setRoutersList] = useState<Router[]>([]);
    const [entriesPerPage, setEntriesPerPage] = useState<number | 'All'>(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalSubs, setTotalSubs] = useState(0);
    const [summaries, setSummaries] = useState<SubscriptionSummaries | null>(null);

    const fetchSubs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await activeSubscribersApi.list({
                search: searchTerm,
                type: activeTab,
                onlineStatus: onlineFilter,
                routerId: routerFilter,
                page: currentPage,
                limit: entriesPerPage
            });
            setSubs((res.data || []) as unknown as ActiveSubscriber[]);
            setTotalSubs(res.total || 0);
            const summariesData = (res.summaries as unknown) as SubscriptionSummaries | undefined;
            setSummaries(summariesData || null);
        } catch (err) {
            console.error('Failed to fetch active subscriptions:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, activeTab, onlineFilter, routerFilter, currentPage, entriesPerPage]);

    const fetchRouters = async () => {
        try {
            const data = await routersApi.list();
            setRoutersList(data as unknown as Router[]);
        } catch (err) {
            console.error('Failed to fetch routers:', err);
        }
    };

    useEffect(() => {
        fetchSubs();
    }, [fetchSubs]);

    useEffect(() => {
        fetchRouters();
    }, []);

    // Reset pagination on filter change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab, onlineFilter, routerFilter, entriesPerPage]);

    const stats = {
        total: summaries?.totalActive || 0,
        online: summaries?.online || 0,
        offline: summaries?.offline || 0,
        pppoe: 0,
        hotspot: 0,
    };



    return (
        <div>
            {deleteId && (
                <ConfirmDeleteModal
                    title="Delete Subscription"
                    message="Are you sure you want to delete this subscription? This action cannot be undone."
                    onClose={() => setDeleteId(null)}
                    onConfirm={async () => {
                        try {
                            await subscriptionsApi.delete(deleteId);
                            setDeleteId(null);
                            fetchSubs();
                        } catch (err) {
                            console.error('Failed to delete subscription:', err);
                            alert('Failed to delete subscription.');
                        }
                    }}
                />
            )}
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                        <PersonIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Active Subscribers</h1>
                        <p className="page-subtitle">Manage all active customer plans across your network</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => navigate('/recharge')}>
                        <AddIcon fontSize="small" /> New Subscription
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards">
                <div className="stat-card green">
                    <div className="stat-card-label">Total Active</div>
                    <div className="stat-card-value">{stats.total}</div>
                    <PersonIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card blue">
                    <div className="stat-card-label">Online Users</div>
                    <div className="stat-card-value">{stats.online}</div>
                    <PowerSettingsNewIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card red">
                    <div className="stat-card-label">Offline Users</div>
                    <div className="stat-card-value">{stats.offline}</div>
                    <PowerSettingsNewIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card indigo">
                    <div className="stat-card-label">PPPoE Active</div>
                    <div className="stat-card-value">{stats.pppoe}</div>
                    <WifiIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card purple">
                    <div className="stat-card-label">Hotspot Active</div>
                    <div className="stat-card-value">{stats.hotspot}</div>
                    <WifiIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
            </div>

            {/* Table Card */}
            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ gap: '15px' }}>
                        <div className="filter-chips">
                            <button
                                className={`filter-chip ${activeTab === 'All' ? 'active' : ''}`}
                                onClick={() => setActiveTab('All')}
                            >
                                📋 All
                            </button>
                            <button
                                className={`filter-chip pppoe ${activeTab === 'PPPoE' ? 'active' : ''}`}
                                onClick={() => setActiveTab('PPPoE')}
                            >
                                🌐 PPPoE
                            </button>
                            <button
                                className={`filter-chip hotspot ${activeTab === 'Hotspot' ? 'active' : ''}`}
                                onClick={() => setActiveTab('Hotspot')}
                            >
                                📶 Hotspot
                            </button>
                        </div>

                        <div className="filter-chips">
                            <button
                                className={`filter-chip online ${onlineFilter === 'Online' ? 'active' : ''}`}
                                onClick={() => setOnlineFilter(onlineFilter === 'Online' ? 'All' : 'Online')}
                            >
                                🟢 Online
                            </button>
                            <button
                                className={`filter-chip offline ${onlineFilter === 'Offline' ? 'active' : ''}`}
                                onClick={() => setOnlineFilter(onlineFilter === 'Offline' ? 'All' : 'Offline')}
                            >
                                🔴 Offline
                            </button>
                        </div>

                        <select className="select-field" style={{ minWidth: 150 }} value={routerFilter} onChange={(e) => setRouterFilter(e.target.value)}>
                            <option value="All">All Routers</option>
                            {routersList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>

                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search username, plan, MAC..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchSubs()}>
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

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input type="checkbox" className="checkbox" />
                                </th>
                                <th>User</th>
                                <th>Plan</th>
                                <th>Type</th>
                                <th>Device</th>
                                <th>Created</th>
                                <th>Expires</th>
                                <th>Method</th>
                                <th>Router</th>
                                <th>Status</th>
                                <th>Online</th>
                                <th>Sync</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ marginBottom: 10 }}><SyncIcon className="spin" /></div>
                                        Fetching active subscribers...
                                    </td>
                                </tr>
                            ) : subs.length === 0 ? (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        No active subscriptions found.
                                    </td>
                                </tr>
                            ) : (
                                subs.map((sub) => (
                                    <tr key={sub.id}>
                                        <td>
                                            <input type="checkbox" className="checkbox" />
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                    <PersonIcon fontSize="small" />
                                                </div>
                                                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{sub.user}</div>
                                            </div>
                                        </td>
                                        <td>{sub.plan}</td>
                                        <td>
                                            <span className={`badge ${sub.type.toLowerCase()}`}>{sub.type}</span>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.82rem' }}>
                                                <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{sub.macAddress}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{sub.device}</div>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.82rem' }}>{formatDate(sub.created)}</td>
                                        <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary)' }}>{formatDate(sub.expires)}</td>
                                        <td style={{ fontSize: '0.82rem' }}>{sub.method}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
                                                <CellTowerIcon style={{ fontSize: 14, color: 'var(--text-muted)' }} />
                                                {sub.router}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge active">Active</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${sub.online.toLowerCase()}`}>
                                                {sub.online === 'Online' ? '● ' : '○ '}{sub.online}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.78rem' }}>
                                            <span style={{ color: sub.sync === 'Synced' ? '#16a34a' : '#f59e0b' }}>{sub.sync}</span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon edit" title="Edit Plan" onClick={() => navigate('/edit-plan/' + sub.id)}>
                                                    <EditIcon style={{ fontSize: 16 }} />
                                                </button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => setDeleteId(sub.id)}>
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

                {/* Pagination */}
                <div className="pagination">
                    <div className="pagination-info">
                        Showing {totalSubs === 0 ? 0 : (currentPage - 1) * (entriesPerPage === 'All' ? totalSubs : (entriesPerPage as number)) + 1}
                        to {entriesPerPage === 'All' ? totalSubs : Math.min(currentPage * (entriesPerPage as number), totalSubs)}
                        of {totalSubs} subscribers
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

                        {Array.from({ length: entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalSubs / (entriesPerPage as number))) }, (_, i) => i + 1).map(page => (
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
                            disabled={currentPage === (entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalSubs / (entriesPerPage as number))))}
                            onClick={() => setCurrentPage(p => Math.min(entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalSubs / (entriesPerPage as number))), p + 1))}
                            style={{ opacity: currentPage === (entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalSubs / (entriesPerPage as number)))) ? 0.5 : 1 }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
