import { useState, useEffect } from 'react';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ExtensionIcon from '@mui/icons-material/Extension';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import TodayIcon from '@mui/icons-material/Today';
import WifiIcon from '@mui/icons-material/Wifi';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { expiredSubscribersApi, subscriptionsApi, routersApi } from '../api/client';
import { formatDate } from '../utils/formatters';
import type { ExpiredSubscriber, Router } from '../types';
import ExtendSubscriberModal from '../modals/ExtendSubscriberModal';

type TabFilter = 'All' | 'PPPoE' | 'Hotspot';

export default function ExpiredSubscribers() {
    const navigate = useNavigate();
    const [subs, setSubs] = useState<ExpiredSubscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabFilter>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [routerFilter, setRouterFilter] = useState('All');
    const [routersList, setRoutersList] = useState<Router[]>([]);
    const [entriesPerPage, setEntriesPerPage] = useState<number | 'All'>(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalSubs, setTotalSubs] = useState(0);
    const [summaries, setSummaries] = useState<any>(null);
    const [extendSub, setExtendSub] = useState<ExpiredSubscriber | null>(null);
    const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
    const [bulkExtending, setBulkExtending] = useState(false);

    const fetchSubs = async () => {
        setLoading(true);
        try {
            const res = await expiredSubscribersApi.list({
                search: searchTerm,
                type: activeTab,
                routerId: routerFilter,
                page: currentPage,
                limit: entriesPerPage
            });
            setSubs((res.data || []) as unknown as ExpiredSubscriber[]);
            setTotalSubs(res.total || 0);
            setSummaries(res.summaries || null);
        } catch (err) {
            console.error('Failed to fetch expired subscriptions:', err);
        } finally {
            setLoading(false);
            setSelectedSubs([]);
        }
    };

    const handleBulkExtend = async () => {
        if (selectedSubs.length === 0) return alert('Please select at least one subscriber to extend.');
        if (!window.confirm(`Are you sure you want to reactivate ${selectedSubs.length} subscriber(s) for 30 days?`)) return;

        setBulkExtending(true);
        try {
            const res = await expiredSubscribersApi.bulkExtend(selectedSubs);
            alert(`Bulk Extension completed.\nSuccess: ${res?.successes?.length || 0}\nFailed: ${res?.failures?.length || 0}`);
            setSelectedSubs([]);
            fetchSubs();
        } catch (err: any) {
            console.error('Bulk extend failed:', err);
            alert(`Bulk extend failed: ${err.message || 'Unknown error'}`);
        } finally {
            setBulkExtending(false);
        }
    };

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
    }, [searchTerm, activeTab, routerFilter, currentPage, entriesPerPage]);

    useEffect(() => {
        fetchRouters();
    }, []);

    // Reset pagination on filter change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab, routerFilter, entriesPerPage]);

    const stats = {
        totalExpired: summaries?.totalExpired || 0,
        thisWeek: summaries?.thisWeek || 0,
        extendedToday: summaries?.extendedToday || 0,
        pppoe: summaries?.pppoe || 0,
        hotspot: summaries?.hotspot || 0,
        active: summaries?.active || 0,
    };

    return (
        <div>
            {extendSub && (
                <ExtendSubscriberModal
                    subscriber={extendSub}
                    onClose={() => setExtendSub(null)}
                    onSave={async (data) => {
                        try {
                            await subscriptionsApi.create(data as Record<string, unknown>);
                            setExtendSub(null);
                            fetchSubs();
                            alert('Subscription extended successfully!');
                        } catch (err) {
                            console.error('Failed to extend subscription:', err);
                            alert('Failed to extend subscription.');
                        }
                    }}
                />
            )}
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <PersonOffIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Expired Subscribers</h1>
                        <p className="page-subtitle">Manage and extend expired customer subscriptions</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <div className="breadcrumb">
                        <a href="/">Dashboard</a> <span>/</span> <a href="/active-subscribers">Plans</a>{' '}
                        <span>/</span> Expired
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                <div className="stat-card red">
                    <div className="stat-card-label">Total Expired</div>
                    <div className="stat-card-value">{stats.totalExpired}</div>
                    <TimerOffIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card orange">
                    <div className="stat-card-label">This Week</div>
                    <div className="stat-card-value">{stats.thisWeek}</div>
                    <TodayIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card teal">
                    <div className="stat-card-label">Extended Today</div>
                    <div className="stat-card-value">{stats.extendedToday}</div>
                    <ExtensionIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card blue">
                    <div className="stat-card-label">PPPoE</div>
                    <div className="stat-card-value">{stats.pppoe}</div>
                    <WifiIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card cyan">
                    <div className="stat-card-label">Hotspot</div>
                    <div className="stat-card-value">{stats.hotspot}</div>
                    <WifiIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card green">
                    <div className="stat-card-label">Active</div>
                    <div className="stat-card-value">{stats.active}</div>
                    <PersonIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
            </div>

            {/* Card */}
            <div className="card">
                {/* Tabs + Toolbar */}
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="filter-chips">
                            <button
                                className={`filter-chip ${activeTab === 'All' ? 'active' : ''}`}
                                onClick={() => setActiveTab('All')}
                            >
                                📋 All ({stats.totalExpired})
                            </button>
                            <button
                                className={`filter-chip ${activeTab === 'PPPoE' ? 'active' : ''}`}
                                onClick={() => setActiveTab('PPPoE')}
                            >
                                🌐 PPPoE ({stats.pppoe})
                            </button>
                            <button
                                className={`filter-chip ${activeTab === 'Hotspot' ? 'active' : ''}`}
                                onClick={() => setActiveTab('Hotspot')}
                            >
                                📶 Hotspot ({stats.hotspot})
                            </button>
                        </div>

                        <select className="select-field" style={{ minWidth: 120 }} value={routerFilter} onChange={(e) => setRouterFilter(e.target.value)}>
                            <option value="All">All Routers</option>
                            {routersList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-secondary btn-sm">
                            🔍
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchSubs()}>
                            <RefreshIcon fontSize="small" /> Refresh
                        </button>
                        <button 
                            className="btn btn-primary btn-sm" 
                            disabled={selectedSubs.length === 0 || bulkExtending} 
                            onClick={handleBulkExtend}
                            style={{ opacity: selectedSubs.length === 0 || bulkExtending ? 0.6 : 1, cursor: selectedSubs.length === 0 || bulkExtending ? 'not-allowed' : 'pointer' }}
                        >
                            {bulkExtending ? 'Extending...' : `Blk Extend (${selectedSubs.length}) →`}
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
                                <th style={{ width: 40 }}>
                                    <input 
                                        type="checkbox" 
                                        className="checkbox" 
                                        checked={subs.length > 0 && selectedSubs.length === subs.length}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedSubs(subs.map(s => s.id));
                                            else setSelectedSubs([]);
                                        }}
                                    />
                                </th>
                                <th>Username</th>
                                <th>Plan</th>
                                <th>Type</th>
                                <th>Router</th>
                                <th>Expired Date</th>
                                <th>Days</th>
                                <th>Method</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading expired subscriptions...
                                    </td>
                                </tr>
                            ) : subs.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No expired subscriptions found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                subs.map((sub) => (
                                    <tr key={sub.id} style={{ background: selectedSubs.includes(sub.id) ? '#f0f9ff' : 'transparent' }}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                className="checkbox" 
                                                checked={selectedSubs.includes(sub.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedSubs([...selectedSubs, sub.id]);
                                                    else setSelectedSubs(selectedSubs.filter(id => id !== sub.id));
                                                }}
                                            />
                                        </td>
                                        <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{sub.username}</td>
                                        <td>{sub.plan}</td>
                                        <td>
                                            <span className={`badge ${sub.type.toLowerCase()}`}>{sub.type}</span>
                                        </td>
                                        <td>{sub.router}</td>
                                        <td>{formatDate(sub.expiredDate)}</td>
                                        <td>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    background: sub.days > 5 ? '#ff9800' : sub.days > 0 ? '#4caf50' : '#2196f3',
                                                    color: 'white',
                                                    textAlign: 'center',
                                                    lineHeight: '24px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {sub.days}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.8rem' }}>{sub.method}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon edit" title="Edit" onClick={() => navigate('/edit-plan/' + sub.id)}>
                                                    <EditIcon style={{ fontSize: 16 }} />
                                                </button>
                                                <button className="btn-icon view" title="Extend" onClick={() => setExtendSub(sub)}>
                                                    <VisibilityIcon style={{ fontSize: 16 }} />
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
                        Showing {totalSubs === 0 ? 0 : (currentPage - 1) * (entriesPerPage === 'All' ? totalSubs : (entriesPerPage as number)) + 1} to {entriesPerPage === 'All' ? totalSubs : Math.min(currentPage * (entriesPerPage as number), totalSubs)} of {totalSubs} entries
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
                            style={{ opacity: currentPage === (entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalSubs / (entriesPerPage as number)))) ? 0.5 : 1, cursor: currentPage === (entriesPerPage === 'All' ? 1 : Math.max(1, Math.ceil(totalSubs / (entriesPerPage as number)))) ? 'not-allowed' : 'pointer' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
