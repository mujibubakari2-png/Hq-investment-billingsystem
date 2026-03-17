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
import DescriptionIcon from '@mui/icons-material/Description';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import WifiIcon from '@mui/icons-material/Wifi';
import PersonIcon from '@mui/icons-material/Person';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SyncIcon from '@mui/icons-material/Sync';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { routersApi } from '../api/client';
import AddRouterModal from '../modals/AddRouterModal';
import RouterDetailModal from '../modals/RouterDetailModal';
import MikrotikScriptModal from '../modals/MikrotikScriptModal';
import WireGuardConfigModal from '../modals/WireGuardConfigModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import type { Router } from '../types';

type TabType = 'routers' | 'pppoe' | 'hotspot' | 'sessions' | 'logs';

export default function Mikrotiks() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('routers');
    const [routers, setRouters] = useState<Router[]>([]);
    const [selectedRouterId, setSelectedRouterId] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedRouter, setSelectedRouter] = useState<Router | null>(null);
    const [selectedRouterToEdit, setSelectedRouterToEdit] = useState<Router | null>(null);
    const [scriptRouter, setScriptRouter] = useState<Router | null>(null);
    const [wireguardRouter, setWireguardRouter] = useState<Router | null>(null);
    const [deleteRouter, setDeleteRouter] = useState<Router | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [testingId, setTestingId] = useState<string>('');

    // PPPoE / Hotspot / Sessions / Logs state
    const [pppoeUsers, setPppoeUsers] = useState<any[]>([]);
    const [hotspotUsers, setHotspotUsers] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [tabLoading, setTabLoading] = useState(false);

    // PPPoE / Hotspot create forms
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', password: '', profile: 'default', service: 'pppoe', server: 'all', comment: '' });

    const fetchRouters = async () => {
        setLoading(true);
        try {
            const data = await routersApi.list();
            setRouters(data as unknown as Router[]);
            if (data.length > 0 && !selectedRouterId) {
                setSelectedRouterId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load routers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRouters(); }, []);

    // Load tab data when tab or selected router changes
    useEffect(() => {
        if (!selectedRouterId) return;
        if (activeTab === 'pppoe') loadPPPoEUsers();
        else if (activeTab === 'hotspot') loadHotspotUsers();
        else if (activeTab === 'sessions') loadSessions();
        else if (activeTab === 'logs') loadLogs();
    }, [activeTab, selectedRouterId]);

    const loadPPPoEUsers = async () => {
        setTabLoading(true);
        try {
            const data = await routersApi.pppoe.list(selectedRouterId);
            setPppoeUsers(data);
        } catch { setPppoeUsers([]); }
        setTabLoading(false);
    };

    const loadHotspotUsers = async () => {
        setTabLoading(true);
        try {
            const data = await routersApi.hotspot.list(selectedRouterId);
            setHotspotUsers(data);
        } catch { setHotspotUsers([]); }
        setTabLoading(false);
    };

    const loadSessions = async () => {
        setTabLoading(true);
        try {
            const data = await routersApi.sessions.list(selectedRouterId);
            setSessions(data);
        } catch { setSessions([]); }
        setTabLoading(false);
    };

    const loadLogs = async () => {
        setTabLoading(true);
        try {
            const params: Record<string, string> = { limit: '50' };
            if (selectedRouterId) params.routerId = selectedRouterId;
            const data = await routersApi.logs.list(params);
            setLogs(data.data || []);
        } catch { setLogs([]); }
        setTabLoading(false);
    };

    const handleAddRouter = async (data: any) => {
        try {
            await routersApi.create({
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
            alert('Router created successfully!');
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

    const handleTestConnection = async (routerId: string) => {
        setTestingId(routerId);
        try {
            const result = await routersApi.testConnection(routerId);
            if (result.success) {
                alert(`✅ Connected successfully!\n\nRouterOS: ${result.info?.version || 'N/A'}\nCPU: ${result.info?.cpuLoad || 0}%\nUptime: ${result.info?.uptime || 'N/A'}`);
                fetchRouters();
            } else {
                alert(`❌ Connection failed: ${result.message}`);
            }
        } catch (err: any) {
            alert(`❌ Connection error: ${err.message}`);
        }
        setTestingId('');
    };

    const handleCreateUser = async (type: 'pppoe' | 'hotspot') => {
        if (!newUser.name || !newUser.password) {
            alert('Username and password are required');
            return;
        }
        try {
            if (type === 'pppoe') {
                await routersApi.pppoe.create(selectedRouterId, newUser);
                loadPPPoEUsers();
            } else {
                await routersApi.hotspot.create(selectedRouterId, newUser);
                loadHotspotUsers();
            }
            setShowCreateUser(false);
            setNewUser({ name: '', password: '', profile: 'default', service: 'pppoe', server: 'all', comment: '' });
            alert(`${type.toUpperCase()} user created!`);
        } catch (err: any) {
            alert(`Failed: ${err.message}`);
        }
    };

    const handleToggleUser = async (type: 'pppoe' | 'hotspot', userId: string, disabled: boolean, username: string) => {
        try {
            if (type === 'pppoe') {
                await routersApi.pppoe.update(selectedRouterId, userId, { disabled, name: username });
                loadPPPoEUsers();
            } else {
                await routersApi.hotspot.update(selectedRouterId, userId, { disabled, name: username });
                loadHotspotUsers();
            }
        } catch (err: any) {
            alert(`Failed: ${err.message}`);
        }
    };

    const handleDeleteUser = async (type: 'pppoe' | 'hotspot', userId: string) => {
        if (!confirm('Delete this user from the router?')) return;
        try {
            if (type === 'pppoe') {
                await routersApi.pppoe.delete(selectedRouterId, userId);
                loadPPPoEUsers();
            } else {
                await routersApi.hotspot.delete(selectedRouterId, userId);
                loadHotspotUsers();
            }
        } catch (err: any) {
            alert(`Failed: ${err.message}`);
        }
    };

    const handleDisconnect = async (sessionId: string, service: string, username: string) => {
        if (!confirm(`Disconnect ${username}?`)) return;
        try {
            await routersApi.sessions.disconnect(selectedRouterId, { sessionId, service, username });
            loadSessions();
            alert(`${username} disconnected`);
        } catch (err: any) {
            alert(`Failed: ${err.message}`);
        }
    };

    const filtered = routers.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.host.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedRouterObj = routers.find(r => r.id === selectedRouterId);

    const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: 'routers', label: 'Routers', icon: <RouterIcon style={{ fontSize: 16 }} /> },
        { key: 'pppoe', label: 'PPPoE Users', icon: <PersonIcon style={{ fontSize: 16 }} /> },
        { key: 'hotspot', label: 'Hotspot Users', icon: <WifiIcon style={{ fontSize: 16 }} /> },
        { key: 'sessions', label: 'Active Sessions', icon: <SyncIcon style={{ fontSize: 16 }} /> },
        { key: 'logs', label: 'Logs', icon: <HistoryIcon style={{ fontSize: 16 }} /> },
    ];

    return (
        <div>
            {showAddModal && <AddRouterModal onClose={() => setShowAddModal(false)} onSave={handleAddRouter} />}
            {selectedRouterToEdit && <AddRouterModal onClose={() => setSelectedRouterToEdit(null)} onSave={handleEditRouter} initialData={selectedRouterToEdit} />}
            {selectedRouter && <RouterDetailModal router={selectedRouter} onClose={() => setSelectedRouter(null)} onEdit={(r) => { setSelectedRouter(null); setSelectedRouterToEdit(r); }} onDelete={(r) => { setSelectedRouter(null); setDeleteRouter(r); }} />}
            {scriptRouter && <MikrotikScriptModal router={scriptRouter} onClose={() => setScriptRouter(null)} />}
            {wireguardRouter && <WireGuardConfigModal router={wireguardRouter} onClose={() => setWireguardRouter(null)} />}
            {deleteRouter && (
                <ConfirmDeleteModal
                    title="Delete Router"
                    message={`Are you sure you want to delete router "${deleteRouter.name}"? This will remove all its configuration and cannot be undone.`}
                    onClose={() => setDeleteRouter(null)}
                    onConfirm={() => handleDelete(deleteRouter.id)}
                />
            )}

            {/* Create User Modal */}
            {showCreateUser && (
                <div className="modal-overlay" onClick={() => setShowCreateUser(false)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">
                                {activeTab === 'pppoe' ? '👤 Create PPPoE User' : '📶 Create Hotspot User'}
                            </div>
                            <button className="modal-close" onClick={() => setShowCreateUser(false)}>
                                <CancelIcon fontSize="small" />
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '16px 24px' }}>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Username <span className="required">*</span></label>
                                <input className="form-input" placeholder="e.g., customer_john" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Password <span className="required">*</span></label>
                                <input className="form-input" placeholder="User password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Profile (Bandwidth)</label>
                                <input className="form-input" placeholder="default" value={newUser.profile} onChange={e => setNewUser({ ...newUser, profile: e.target.value })} />
                            </div>
                            {activeTab === 'hotspot' && (
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Server</label>
                                    <input className="form-input" placeholder="all" value={newUser.server} onChange={e => setNewUser({ ...newUser, server: e.target.value })} />
                                </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Comment</label>
                                <input className="form-input" placeholder="Optional note" value={newUser.comment} onChange={e => setNewUser({ ...newUser, comment: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border-light)' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCreateUser(false)}>Cancel</button>
                            <button className="btn" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 600 }} onClick={() => handleCreateUser(activeTab as 'pppoe' | 'hotspot')}>
                                <AddIcon fontSize="small" /> Create User
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <RouterIcon />
                    </div>
                    <div>
                        <h1 className="page-title">MikroTik Router Management</h1>
                        <p className="page-subtitle">Manage routers, PPPoE & Hotspot users, sessions and VPN</p>
                    </div>
                </div>
                <div className="page-header-right" style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600 }} onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> New Router
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border-light)', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '12px 20px', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap',
                            background: activeTab === tab.key ? '#fff' : 'transparent',
                            color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                            marginBottom: '-2px',
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Router Selector (for non-routers tabs) */}
            {activeTab !== 'routers' && routers.length > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                    padding: '10px 16px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                }}>
                    <RouterIcon style={{ color: '#d97706', fontSize: 20 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Router:</span>
                    <select
                        className="select-field"
                        style={{ minWidth: 200 }}
                        value={selectedRouterId}
                        onChange={e => setSelectedRouterId(e.target.value)}
                    >
                        {routers.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.host})</option>
                        ))}
                    </select>
                    {selectedRouterObj && (
                        <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                            background: selectedRouterObj.status === 'Online' ? '#d1fae5' : '#fee2e2',
                            color: selectedRouterObj.status === 'Online' ? '#065f46' : '#dc2626',
                        }}>
                            {selectedRouterObj.status === 'Online' ? '● Online' : '○ Offline'}
                        </span>
                    )}
                    {activeTab !== 'logs' && (
                        <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
                            onClick={() => {
                                if (activeTab === 'pppoe') loadPPPoEUsers();
                                else if (activeTab === 'hotspot') loadHotspotUsers();
                                else if (activeTab === 'sessions') loadSessions();
                            }}>
                            <SyncIcon style={{ fontSize: 14 }} /> Refresh
                        </button>
                    )}
                    {(activeTab === 'pppoe' || activeTab === 'hotspot') && (
                        <button className="btn" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}
                            onClick={() => setShowCreateUser(true)}>
                            <AddIcon style={{ fontSize: 14 }} /> Add User
                        </button>
                    )}
                </div>
            )}

            {/* ═══ ROUTERS TAB ═══ */}
            {activeTab === 'routers' && (
                <div className="card">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left" style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" style={{ background: '#e0e7ff', color: '#4338ca', fontWeight: 600, border: '1px solid #c7d2fe', fontSize: '0.8rem' }}
                                onClick={() => {
                                    if (routers.length === 0) { alert('No routers. Add one first.'); return; }
                                    if (routers.length === 1) setScriptRouter(routers[0]);
                                    else { const r = routers.find(x => x.id === selectedRouterId) || routers[0]; setScriptRouter(r); }
                                }}>
                                <DownloadIcon style={{ fontSize: 14 }} /> Mikrotik Script
                            </button>
                            <button className="btn" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600, border: '1px solid #bbf7d0', fontSize: '0.8rem' }}
                                onClick={() => {
                                    if (routers.length === 0) { alert('No routers. Add one first.'); return; }
                                    if (routers.length === 1) setWireguardRouter(routers[0]);
                                    else { const r = routers.find(x => x.id === selectedRouterId) || routers[0]; setWireguardRouter(r); }
                                }}>
                                <VpnLockIcon style={{ fontSize: 14 }} /> WireGuard
                            </button>
                            <button className="btn" style={{ background: '#fef3c7', color: '#d97706', fontWeight: 600, border: '1px solid #fde68a', fontSize: '0.8rem' }}
                                onClick={() => {
                                    if (routers.length === 0) { alert('No routers. Add one first.'); return; }
                                    const r = routers.find(x => x.id === selectedRouterId) || routers[0];
                                    navigate(`/hotspot-customizer?routerId=${r.id}`);
                                }}>
                                <WifiIcon style={{ fontSize: 14 }} /> Customize Hotspot
                            </button>
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
                                    <th>API Port</th>
                                    <th>Status</th>
                                    <th>Active Users</th>
                                    <th>CPU Load</th>
                                    <th>Uptime</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading routers...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No routers found. Click "New Router" to add one.</td></tr>
                                ) : filtered.map((router) => (
                                    <tr key={router.id}>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{router.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{router.description || router.type}</div>
                                        </td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{router.host}</span></td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{router.port || 8728}</span></td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '4px 10px', borderRadius: 20, fontWeight: 500, fontSize: '0.78rem',
                                                background: router.status === 'Online' ? '#d1fae5' : '#fee2e2',
                                                color: router.status === 'Online' ? '#065f46' : '#dc2626',
                                            }}>
                                                {router.status === 'Online' ? <CheckCircleIcon style={{ fontSize: 12 }} /> : <CancelIcon style={{ fontSize: 12 }} />}
                                                {router.status}
                                            </span>
                                        </td>
                                        <td><span style={{ fontWeight: 600 }}>{router.activeUsers}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 50, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min(router.cpuLoad, 100)}%`, height: '100%', borderRadius: 3,
                                                        background: router.cpuLoad > 80 ? '#ef4444' : router.cpuLoad > 50 ? '#f59e0b' : '#22c55e',
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.78rem' }}>{router.cpuLoad}%</span>
                                            </div>
                                        </td>
                                        <td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{router.uptime || '-'}</span></td>
                                        <td>
                                            <div className="table-actions" style={{ display: 'flex', gap: 3 }}>
                                                <button className="btn-icon" style={{ background: '#dbeafe', color: '#2563eb' }} title="Test Connection"
                                                    onClick={() => handleTestConnection(router.id)}
                                                    disabled={testingId === router.id}>
                                                    {testingId === router.id
                                                        ? <SyncIcon style={{ fontSize: 14, animation: 'spin 1s linear infinite' }} />
                                                        : <PowerSettingsNewIcon style={{ fontSize: 14 }} />}
                                                </button>
                                                <button className="btn-icon" style={{ background: '#fef2f2', color: '#dc2626' }} title="View Details"
                                                    onClick={() => setSelectedRouter(router)}>
                                                    <VisibilityIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon" style={{ background: '#e0e7ff', color: '#4338ca' }} title="MikroTik Script"
                                                    onClick={() => setScriptRouter(router)}>
                                                    <DescriptionIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon" style={{ background: '#dcfce7', color: '#15803d' }} title="WireGuard"
                                                    onClick={() => setWireguardRouter(router)}>
                                                    <VpnLockIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon" style={{ background: '#fef3c7', color: '#92400e' }} title="Customize Hotspot"
                                                    onClick={() => navigate(`/hotspot-customizer?routerId=${router.id}`)}>
                                                    <WifiIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon" style={{ background: '#fef3c7', color: '#d97706' }} title="Settings"
                                                    onClick={() => navigate(`/router-setup/${router.id}`)}>
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
                </div>
            )}

            {/* ═══ PPPOE USERS TAB ═══ */}
            {activeTab === 'pppoe' && (
                <div className="card">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Service</th>
                                    <th>Profile</th>
                                    <th>Status</th>
                                    <th>Comment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tabLoading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading PPPoE users...</td></tr>
                                ) : pppoeUsers.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        No PPPoE users found. {routers.length > 0 ? 'Add one using the "Add User" button.' : 'Connect a router first.'}
                                    </td></tr>
                                ) : pppoeUsers.map((user, i) => (
                                    <tr key={user.id || i}>
                                        <td><span style={{ fontWeight: 600 }}>{user.name}</span></td>
                                        <td><span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#dbeafe', color: '#2563eb' }}>{user.service}</span></td>
                                        <td><span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#f3f4f6', color: '#374151' }}>{user.profile}</span></td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                                                background: user.disabled ? '#fee2e2' : '#d1fae5',
                                                color: user.disabled ? '#dc2626' : '#065f46',
                                            }}>
                                                {user.disabled ? 'Disabled' : 'Active'}
                                            </span>
                                        </td>
                                        <td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.comment || '-'}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" title={user.disabled ? 'Enable' : 'Disable'}
                                                    style={{ background: user.disabled ? '#d1fae5' : '#fee2e2', color: user.disabled ? '#065f46' : '#dc2626' }}
                                                    onClick={() => handleToggleUser('pppoe', user.id, !user.disabled, user.name)}>
                                                    <PowerSettingsNewIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => handleDeleteUser('pppoe', user.id)}>
                                                    <DeleteIcon style={{ fontSize: 14 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ HOTSPOT USERS TAB ═══ */}
            {activeTab === 'hotspot' && (
                <div className="card">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Profile</th>
                                    <th>Server</th>
                                    <th>MAC Address</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tabLoading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading Hotspot users...</td></tr>
                                ) : hotspotUsers.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        No Hotspot users found. {routers.length > 0 ? 'Add one using the "Add User" button.' : 'Connect a router first.'}
                                    </td></tr>
                                ) : hotspotUsers.map((user, i) => (
                                    <tr key={user.id || i}>
                                        <td><span style={{ fontWeight: 600 }}>{user.name}</span></td>
                                        <td><span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>{user.profile}</span></td>
                                        <td><span style={{ fontSize: '0.85rem' }}>{user.server}</span></td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{user.macAddress || '-'}</span></td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                                                background: user.disabled ? '#fee2e2' : '#d1fae5',
                                                color: user.disabled ? '#dc2626' : '#065f46',
                                            }}>
                                                {user.disabled ? 'Disabled' : 'Active'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" title={user.disabled ? 'Enable' : 'Disable'}
                                                    style={{ background: user.disabled ? '#d1fae5' : '#fee2e2', color: user.disabled ? '#065f46' : '#dc2626' }}
                                                    onClick={() => handleToggleUser('hotspot', user.id, !user.disabled, user.name)}>
                                                    <PowerSettingsNewIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => handleDeleteUser('hotspot', user.id)}>
                                                    <DeleteIcon style={{ fontSize: 14 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ SESSIONS TAB ═══ */}
            {activeTab === 'sessions' && (
                <div className="card">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>IP Address</th>
                                    <th>Service</th>
                                    <th>Uptime</th>
                                    <th>Download</th>
                                    <th>Upload</th>
                                    <th>Caller ID</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tabLoading ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading sessions...</td></tr>
                                ) : sessions.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No active sessions</td></tr>
                                ) : sessions.map((s, i) => (
                                    <tr key={s.id || i}>
                                        <td><span style={{ fontWeight: 600 }}>{s.user}</span></td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.83rem' }}>{s.address}</span></td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                                                background: s.service === 'pppoe' ? '#dbeafe' : '#fef3c7',
                                                color: s.service === 'pppoe' ? '#2563eb' : '#92400e',
                                            }}>
                                                {s.service.toUpperCase()}
                                            </span>
                                        </td>
                                        <td><span style={{ fontSize: '0.83rem' }}>{s.uptime}</span></td>
                                        <td><span style={{ fontSize: '0.83rem', color: '#16a34a' }}>↓ {formatBytes(s.bytesOut)}</span></td>
                                        <td><span style={{ fontSize: '0.83rem', color: '#2563eb' }}>↑ {formatBytes(s.bytesIn)}</span></td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.callerId || '-'}</span></td>
                                        <td>
                                            <button className="btn-icon" style={{ background: '#fee2e2', color: '#dc2626' }} title="Disconnect"
                                                onClick={() => handleDisconnect(s.id, s.service, s.user)}>
                                                <LinkOffIcon style={{ fontSize: 14 }} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ LOGS TAB ═══ */}
            {activeTab === 'logs' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={loadLogs}>
                            <SyncIcon style={{ fontSize: 14 }} /> Refresh Logs
                        </button>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Router</th>
                                    <th>Action</th>
                                    <th>Details</th>
                                    <th>User</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tabLoading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading logs...</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No logs yet</td></tr>
                                ) : logs.map((log: any, i: number) => (
                                    <tr key={log.id || i}>
                                        <td><span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(log.createdAt).toLocaleString()}</span></td>
                                        <td><span style={{ fontWeight: 600, fontSize: '0.83rem' }}>{log.routerName}</span></td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                                                background: log.action.includes('create') ? '#dbeafe' :
                                                    log.action.includes('delete') ? '#fee2e2' :
                                                        log.action.includes('enable') || log.action.includes('activate') ? '#d1fae5' :
                                                            log.action.includes('disable') || log.action.includes('suspend') ? '#fef3c7' :
                                                                log.action.includes('error') || log.action.includes('fail') ? '#fee2e2' : '#f3f4f6',
                                                color: log.action.includes('create') ? '#2563eb' :
                                                    log.action.includes('delete') ? '#dc2626' :
                                                        log.action.includes('enable') || log.action.includes('activate') ? '#065f46' :
                                                            log.action.includes('disable') || log.action.includes('suspend') ? '#92400e' :
                                                                log.action.includes('error') || log.action.includes('fail') ? '#dc2626' : '#374151',
                                            }}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td><span style={{ fontSize: '0.8rem', maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details || '-'}</span></td>
                                        <td><span style={{ fontSize: '0.83rem' }}>{log.username || '-'}</span></td>
                                        <td>
                                            <span style={{
                                                padding: '3px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                                                background: log.status === 'success' ? '#d1fae5' : '#fee2e2',
                                                color: log.status === 'success' ? '#065f46' : '#dc2626',
                                            }}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Spin animation for test connection */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function formatBytes(bytes: string | number): string {
    const b = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (!b || b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
