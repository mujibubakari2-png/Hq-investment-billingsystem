import { useState } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import { useNavigate } from 'react-router-dom';

const mockActiveSubs = [
    {
        id: '1',
        user: 'HS-CW99147',
        plan: 'masaa 24',
        type: 'Hotspot' as const,
        device: 'Mobile',
        macAddress: 'AE:5C:88:12:67:98',
        created: '23 Feb 2026 12:34',
        expires: '24 Feb 2026 22:34',
        method: 'voucher - 43121815',
        router: 'INVESTMENT-123',
        status: 'Active' as const,
        online: 'Online' as const,
        sync: 'S',
    },
    {
        id: '2',
        user: 'HS-WS10605',
        plan: 'siku 3',
        type: 'Hotspot' as const,
        device: 'Mobile',
        macAddress: '08:5E:23:12:88:76',
        created: '23 Feb 2026 12:26',
        expires: '26 Feb 2026 12:26',
        method: 'voucher - Y0CUW',
        router: 'INVESTMENT-123',
        status: 'Active' as const,
        online: 'Online' as const,
        sync: 'S',
    },
];

export default function ActiveSubscribers() {
    const [filter, setFilter] = useState<'All' | 'Online' | 'Offline'>('All');
    const navigate = useNavigate();

    const filtered = mockActiveSubs.filter((sub) => {
        if (filter === 'All') return true;
        return sub.online === filter;
    });

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <PersonIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Plan Management</h1>
                        <p className="page-subtitle">All customer plans including both PPPoE and Hotspot</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <div className="filter-chips">
                        <button
                            className={`filter-chip ${filter === 'All' ? 'active' : ''}`}
                            onClick={() => setFilter('All')}
                        >
                            📋 All
                        </button>
                        <button
                            className={`filter-chip online ${filter === 'Online' ? 'active' : ''}`}
                            onClick={() => setFilter('Online')}
                        >
                            🟢 Online
                        </button>
                        <button
                            className={`filter-chip offline ${filter === 'Offline' ? 'active' : ''}`}
                            onClick={() => setFilter('Offline')}
                        >
                            🔴 Offline
                        </button>
                    </div>
                    <button className="btn btn-secondary">
                        <RefreshIcon fontSize="small" /> Refresh Status
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/recharge')}>
                        <AddIcon fontSize="small" /> Recharge
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className="card">
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
                            {filtered.map((sub) => (
                                <tr key={sub.id}>
                                    <td>
                                        <input type="checkbox" className="checkbox" />
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{sub.user}</td>
                                    <td>{sub.plan}</td>
                                    <td>
                                        <span className={`badge ${sub.type.toLowerCase()}`}>{sub.type}</span>
                                    </td>
                                    <td>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {sub.macAddress}
                                            </span>
                                            <br />
                                            {sub.device}
                                        </div>
                                    </td>
                                    <td>{sub.created}</td>
                                    <td>{sub.expires}</td>
                                    <td style={{ fontSize: '0.8rem' }}>{sub.method}</td>
                                    <td>{sub.router}</td>
                                    <td>
                                        <span className={`badge ${sub.status.toLowerCase()}`}>{sub.status}</span>
                                    </td>
                                    <td>
                                        <span className={`badge ${sub.online.toLowerCase()}`}>{sub.online}</span>
                                    </td>
                                    <td>{sub.sync}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon edit" title="Edit" onClick={() => navigate('/edit-plan/' + sub.id)}>
                                                <EditIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon delete" title="Delete">
                                                <DeleteIcon style={{ fontSize: 16 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
