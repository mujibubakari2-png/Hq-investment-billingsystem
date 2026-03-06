import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RouterIcon from '@mui/icons-material/Router';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { routersApi } from '../api/client';
import AddRouterModal from '../modals/AddRouterModal';
import RouterDetailModal from '../modals/RouterDetailModal';
import type { Router } from '../types';

export default function Mikrotiks() {
    const navigate = useNavigate();
    const [routers, setRouters] = useState<Router[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedRouter, setSelectedRouter] = useState<Router | null>(null);
    const [entriesPerPage, setEntriesPerPage] = useState(25);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        routersApi.list().then(data => setRouters(data as unknown as Router[])).catch(console.error);
    }, []);

    const filtered = routers.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.host.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {showAddModal && <AddRouterModal onClose={() => setShowAddModal(false)} />}
            {selectedRouter && <RouterDetailModal router={selectedRouter} onClose={() => setSelectedRouter(null)} />}

            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <RouterIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Routers</h1>
                        <p className="page-subtitle">Manage your network routers and VPN connections</p>
                    </div>
                </div>
                <div className="page-header-right" style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ background: '#fef3c7', color: '#d97706', fontWeight: 600, border: '1px solid #fbbf24' }}>
                        <DownloadIcon fontSize="small" /> VPN Specific Download
                    </button>
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600 }} onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> New Router
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.85rem' }}>Show</span>
                        <select className="select-field" value={entriesPerPage} onChange={e => setEntriesPerPage(Number(e.target.value))} style={{ width: 70 }}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search routers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Router Name</th>
                                <th>IP Address</th>
                                <th>VPN Type</th>
                                <th>Status</th>
                                <th>Last Seen</th>
                                <th>CPU Load</th>
                                <th>Remote Access</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, entriesPerPage).map((router) => (
                                <tr key={router.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{router.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: MYR-{router.id.padStart(3, '0')}VBHBC</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            🌐 {router.host}
                                            <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#6b7280' }}>🔗</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '4px 12px', borderRadius: 20,
                                            background: '#d1fae5', color: '#065f46', fontWeight: 500, fontSize: '0.8rem'
                                        }}>
                                            🟢 VPN Based
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '4px 12px', borderRadius: 20,
                                            background: '#d1fae5', color: '#065f46', fontWeight: 500, fontSize: '0.8rem'
                                        }}>
                                            ✅ Connected
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '4px 12px', borderRadius: 20,
                                            background: '#dbeafe', color: '#1d4ed8', fontWeight: 500, fontSize: '0.8rem'
                                        }}>
                                            Now!
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '4px 10px', borderRadius: 20,
                                                background: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.8rem'
                                            }}>
                                                📊 {router.cpuLoad}%
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '4px 12px', borderRadius: 20,
                                            background: '#fee2e2', color: '#dc2626', fontWeight: 500, fontSize: '0.8rem'
                                        }}>
                                            ⛔ Not verified
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions" style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" style={{ background: '#fef2f2', color: '#dc2626' }} title="View Details"
                                                onClick={() => setSelectedRouter(router)}>
                                                <VisibilityIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon" style={{ background: '#fef3c7', color: '#d97706' }} title="Settings"
                                                onClick={() => navigate(`/router-setup/${router.id}`)}>
                                                <SettingsIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon edit" title="Edit">
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

                <div className="pagination">
                    <div className="pagination-info">Showing 1 to {Math.min(entriesPerPage, filtered.length)} of {filtered.length} routers</div>
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
