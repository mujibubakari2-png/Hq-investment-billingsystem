import { useState, useEffect } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import { useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '../api/client';
import type { ActiveSubscriber } from '../types';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

export default function ActiveSubscribers() {
    const [filter, setFilter] = useState<'All' | 'Online' | 'Offline'>('All');
    const [subs, setSubs] = useState<ActiveSubscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchSubs = async () => {
        setLoading(true);
        try {
            const res = await subscriptionsApi.list({ status: 'ACTIVE' });
            setSubs((res.data || []) as unknown as ActiveSubscriber[]);
        } catch (err) {
            console.error('Failed to fetch active subscriptions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubs();
    }, []);

    const filtered = subs.filter((sub) => {
        if (filter === 'All') return true;
        return sub.online === filter;
    });

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
                    <button className="btn btn-secondary" onClick={() => fetchSubs()}>
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
                            {loading ? (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading active subscriptions...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No active subscriptions found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((sub) => (
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
            </div>
        </div>
    );
}
