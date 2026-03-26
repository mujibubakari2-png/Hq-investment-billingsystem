import { useState, useEffect } from 'react';
import RouterIcon from '@mui/icons-material/Router';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SettingsIcon from '@mui/icons-material/Settings';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SyncIcon from '@mui/icons-material/Sync';
import { routersApi } from '../api/client';
import AddRouterModal from '../modals/AddRouterModal';
import RouterDetailModal from '../modals/RouterDetailModal';
import MikrotikScriptModal from '../modals/MikrotikScriptModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import RouterSetupWizard from './RouterSetupWizard';
import RemoteAccessModal from '../modals/RemoteAccessModal';
import LanguageIcon from '@mui/icons-material/Language';
import CellTowerIcon from '@mui/icons-material/CellTower';
import type { Router } from '../types';

export default function Mikrotiks() {
    const [routers, setRouters] = useState<Router[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedRouter, setSelectedRouter] = useState<Router | null>(null);
    const [selectedRouterToEdit, setSelectedRouterToEdit] = useState<Router | null>(null);
    const [scriptRouter, setScriptRouter] = useState<Router | null>(null);
    const [deleteRouter, setDeleteRouter] = useState<Router | null>(null);
    const [remoteRouter, setRemoteRouter] = useState<Router | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [wizardRouter, setWizardRouter] = useState<Router | null>(null);
    const [testingId, setTestingId] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);

    const fetchRouters = async () => {
        setLoading(true);
        try {
            const data = await routersApi.list();
            setRouters(data as unknown as Router[]);
        } catch (err) {
            console.error('Failed to load routers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRouters(); }, []);

    const handleAddRouter = async (data: any) => {
        try {
            const res = await routersApi.create({
                name: data.routerName,
                host: data.host || '0.0.0.0',
                username: data.username || 'admin',
                password: data.accessCode,
                port: data.port || 8728,
                apiPort: data.apiPort || 8728,
                vpnMode: data.vpnMode,
                description: data.description,
            });
            setShowAddModal(false);
            fetchRouters();
            setScriptRouter(res as unknown as Router);
            alert('Router created successfully! Please copy the configuration script provided.');
        } catch (err) {
            console.error('Failed to create router:', err);
            alert('Failed to create router.');
        }
    };

    const handleEditRouter = async (data: any) => {
        if (!selectedRouterToEdit) return;
        try {
            await routersApi.update(selectedRouterToEdit.id, {
                name: data.routerName,
                host: data.host,
                username: data.username,
                password: data.accessCode,
                status: data.initialStatus === 'enable' ? 'ACTIVE' : 'INACTIVE',
            });
            setSelectedRouterToEdit(null);
            fetchRouters();
            alert('Router updated successfully!');
        } catch (err) {
            console.error('Failed to update router:', err);
            alert('Failed to update router.');
        }
    };

    const handleTestConnection = async (router: Router) => {
        setTestingId(router.id);
        try {
            const result = await routersApi.testConnection(router.id);
            if ((result as any).success) {
                alert(`✅ Connected! RouterOS ${(result as any).info?.version || ''}`);
            } else {
                alert(`❌ Connection failed: ${(result as any).message || 'Unknown error'}`);
            }
            fetchRouters();
        } catch (err: any) {
            alert(`❌ Connection failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setTestingId('');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await routersApi.delete(id);
            setDeleteRouter(null);
            fetchRouters();
            alert('Router deleted successfully!');
        } catch (err) {
            console.error('Failed to delete router:', err);
            alert('Failed to delete router');
        }
    };

    const filtered = routers.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.host.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const getVpnType = (router: Router) => {
        const mode = (router as any).vpnMode || 'hybrid';
        if (mode === 'wireguard') return 'WireGuard';
        if (mode === 'openvpn') return 'OpenVPN';
        return 'Hybrid';
    };

    const getLastSeen = (router: Router) => {
        if (!router.lastSeen) return 'Never';
        const d = new Date(router.lastSeen);
        if (isNaN(d.getTime())) return 'Never';
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    // If router setup wizard is active, show it full-screen
    if (wizardRouter) {
        return <RouterSetupWizard router={wizardRouter} onClose={() => { setWizardRouter(null); fetchRouters(); }} />;
    }

    return (
        <div>
            {showAddModal && <AddRouterModal onClose={() => setShowAddModal(false)} onSave={handleAddRouter} />}
            {selectedRouterToEdit && <AddRouterModal onClose={() => setSelectedRouterToEdit(null)} onSave={handleEditRouter} initialData={selectedRouterToEdit} />}
            {selectedRouter && <RouterDetailModal router={selectedRouter} onClose={() => setSelectedRouter(null)} onEdit={(r) => { setSelectedRouter(null); setSelectedRouterToEdit(r); }} onDelete={(r) => { setSelectedRouter(null); setDeleteRouter(r); }} />}
            {scriptRouter && <MikrotikScriptModal router={scriptRouter} onClose={() => setScriptRouter(null)} />}
            {deleteRouter && (
                <ConfirmDeleteModal
                    title="Delete Router"
                    message={`Are you sure you want to delete router "${deleteRouter.name}"? This will remove all its configuration and cannot be undone.`}
                    onClose={() => setDeleteRouter(null)}
                    onConfirm={() => handleDelete(deleteRouter.id)}
                />
            )}
            {remoteRouter && <RemoteAccessModal router={remoteRouter} onClose={() => setRemoteRouter(null)} />}

            {/* Page Header */}
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
                    <button
                        className="btn"
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                        onClick={() => {
                            if (routers.length === 0) { alert('No routers. Add one first.'); return; }
                            setScriptRouter(routers[0]);
                        }}
                    >
                        <DownloadIcon style={{ fontSize: 16 }} />
                        <span>
                            <span style={{ fontSize: '0.65rem', display: 'block', lineHeight: 1, opacity: 0.9 }}>API SPECIFIC</span>
                            <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>Download</span>
                        </span>
                    </button>
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600 }} onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> New Router
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Show</span>
                        <select
                            className="select-field"
                            style={{ width: 65, padding: '6px 8px', fontSize: '0.82rem' }}
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search routers..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Router Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>▼</span></th>
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
                            {loading ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading routers...</td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No routers found. Click "New Router" to add one.</td></tr>
                            ) : paginated.map((router) => (
                                <tr key={router.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 6,
                                                background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <RouterIcon style={{ fontSize: 16, color: '#d97706' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{router.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{router.description || router.type || 'MikroTik'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{router.host}</span>
                                            <span style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600,
                                                background: '#f3f4f6', color: '#6b7280',
                                            }}>:{router.port || 8728}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '4px 10px', borderRadius: 20, fontWeight: 600, fontSize: '0.75rem',
                                            background: getVpnType(router) === 'WireGuard' ? '#d1fae5' : getVpnType(router) === 'OpenVPN' ? '#dbeafe' : '#fef3c7',
                                            color: getVpnType(router) === 'WireGuard' ? '#065f46' : getVpnType(router) === 'OpenVPN' ? '#1e40af' : '#92400e',
                                        }}>
                                            {getVpnType(router)}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '4px 10px', borderRadius: 20, fontWeight: 500, fontSize: '0.78rem',
                                            background: router.status === 'Online' ? '#d1fae5' : '#fee2e2',
                                            color: router.status === 'Online' ? '#065f46' : '#dc2626',
                                        }}>
                                            {router.status === 'Online' ? <CheckCircleIcon style={{ fontSize: 12 }} /> : <CancelIcon style={{ fontSize: 12 }} />}
                                            {router.status === 'Online' ? 'Connected' : 'Offline'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                            {getLastSeen(router)}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 50, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.min(router.cpuLoad, 100)}%`, height: '100%', borderRadius: 3,
                                                    background: router.cpuLoad > 80 ? '#ef4444' : router.cpuLoad > 50 ? '#f59e0b' : '#22c55e',
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>{router.cpuLoad}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        {router.status === 'Online' ? (
                                            <button 
                                                className="btn"
                                                onClick={() => setRemoteRouter(router)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    padding: '4px 12px', borderRadius: 20, fontWeight: 600, fontSize: '0.75rem',
                                                    background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe',
                                                    transition: 'all 0.2s', cursor: 'pointer'
                                                }}
                                                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#c7d2fe'; }}
                                                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e0e7ff'; }}
                                            >
                                                <LanguageIcon style={{ fontSize: 13 }} /> Connect
                                            </button>
                                        ) : (
                                            <button 
                                                className="btn"
                                                onClick={() => setRemoteRouter(router)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    padding: '4px 12px', borderRadius: 20, fontWeight: 500, fontSize: '0.75rem',
                                                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                                    transition: 'all 0.2s', cursor: 'pointer'
                                                }}
                                                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fecaca'; }}
                                                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                                            >
                                                <CellTowerIcon style={{ fontSize: 13 }} /> Details
                                            </button>
                                        )}
                                    </td>
                                    <td>
                                        <div className="table-actions" style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" style={{ background: testingId === router.id ? '#fef3c7' : '#e0f2fe', color: testingId === router.id ? '#d97706' : '#0284c7' }}
                                                title="Test Connection" onClick={() => handleTestConnection(router)} disabled={testingId === router.id}>
                                                {testingId === router.id
                                                    ? <SyncIcon style={{ fontSize: 14, animation: 'spin 1s linear infinite' }} />
                                                    : <PowerSettingsNewIcon style={{ fontSize: 14 }} />}
                                            </button>
                                            <button className="btn-icon" style={{ background: '#e0f2fe', color: '#0284c7' }} title="View Details"
                                                onClick={() => setSelectedRouter(router)}>
                                                <VisibilityIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button className="btn-icon" style={{ background: '#fef3c7', color: '#d97706' }} title="Setup Wizard"
                                                onClick={() => setWizardRouter(router)}>
                                                <SettingsIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button className="btn-icon edit" title="Edit" onClick={() => setSelectedRouterToEdit(router)}>
                                                <EditIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button className="btn-icon delete" title="Delete" onClick={() => setDeleteRouter(router)}>
                                                <DeleteIcon style={{ fontSize: 14 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)' }}>
                    <div className="pagination-info" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} routers
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >Previous</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                className="btn"
                                style={{
                                    padding: '5px 10px', fontSize: '0.78rem', minWidth: 32,
                                    background: p === currentPage ? '#16a34a' : 'transparent',
                                    color: p === currentPage ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: p === currentPage ? 700 : 400,
                                    border: p === currentPage ? 'none' : '1px solid var(--border-light)',
                                }}
                                onClick={() => setCurrentPage(p)}
                            >{p}</button>
                        ))}
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
