import { useState } from 'react';
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
import { mockExpiredSubscribers } from '../data/mockData';

type TabFilter = 'All' | 'PPPoE' | 'Hotspot';

export default function ExpiredSubscribers() {
    const [activeTab, setActiveTab] = useState<TabFilter>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(25);

    const stats = {
        totalExpired: 10,
        thisWeek: 0,
        extendedToday: 0,
        pppoe: 0,
        hotspot: 10,
        active: 2,
    };

    const filtered = mockExpiredSubscribers.filter((sub) => {
        const matchesTab = activeTab === 'All' || sub.type === activeTab;
        const matchesSearch = sub.username.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
    });

    return (
        <div>
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
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
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
                                📋 All ({mockExpiredSubscribers.length})
                            </button>
                            <button
                                className={`filter-chip ${activeTab === 'PPPoE' ? 'active' : ''}`}
                                onClick={() => setActiveTab('PPPoE')}
                            >
                                🌐 PPPoE (0)
                            </button>
                            <button
                                className={`filter-chip ${activeTab === 'Hotspot' ? 'active' : ''}`}
                                onClick={() => setActiveTab('Hotspot')}
                            >
                                📶 Hotspot ({mockExpiredSubscribers.length})
                            </button>
                        </div>

                        <select className="select-field" style={{ minWidth: 120 }}>
                            <option>All Routers</option>
                            <option>INVESTMENT-123</option>
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
                        <button className="btn btn-secondary btn-sm">
                            <RefreshIcon fontSize="small" /> Refresh
                        </button>
                        <button className="btn btn-primary btn-sm">
                            Blk Extend →
                        </button>
                    </div>
                </div>

                {/* Show entries */}
                <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-light)' }}>
                    <div className="show-entries">
                        Show{' '}
                        <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value))}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
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
                                    <input type="checkbox" className="checkbox" />
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
                            {filtered.map((sub) => (
                                <tr key={sub.id}>
                                    <td>
                                        <input type="checkbox" className="checkbox" />
                                    </td>
                                    <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{sub.username}</td>
                                    <td>{sub.plan}</td>
                                    <td>
                                        <span className={`badge ${sub.type.toLowerCase()}`}>{sub.type}</span>
                                    </td>
                                    <td>{sub.router}</td>
                                    <td>{sub.expiredDate}</td>
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
                                            <button className="btn-icon edit" title="Edit">
                                                <EditIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon view" title="Extend">
                                                <VisibilityIcon style={{ fontSize: 16 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination">
                    <div className="pagination-info">
                        Showing 1 to {filtered.length} of {filtered.length} entries
                    </div>
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
