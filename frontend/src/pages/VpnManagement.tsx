import { useState, useEffect } from 'react';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import RouterIcon from '@mui/icons-material/Router';
import SpeedIcon from '@mui/icons-material/Speed';
import { vpnApi, routersApi } from '../api/client';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

interface VpnUser {
    id: string;
    username: string;
    fullName: string;
    serverAddress: string;
    protocol: string;
    localAddress: string;
    remoteAddress: string;
    status: string;
    routerId: string;
    routerName: string;
    profile: string;
    uptime: string;
    bytesIn: string;
    bytesOut: string;
    connectedAt: string;
    createdAt: string;
}

export default function VpnManagement() {
    const [vpnUsers, setVpnUsers] = useState<VpnUser[]>([]);
    const [routers, setRouters] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [protocolFilter, setProtocolFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [viewUser, setViewUser] = useState<VpnUser | null>(null);

    // Add form state
    const [formData, setFormData] = useState({
        username: '', password: '', fullName: '',
        protocol: 'L2TP', profile: 'default',
        localAddress: '', remoteAddress: '',
        routerId: '', service: 'l2tp',
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vpnData, routerData] = await Promise.all([
                vpnApi.list(),
                routersApi.list(),
            ]);
            setVpnUsers(vpnData as unknown as VpnUser[]);
            setRouters(routerData as unknown as Array<{ id: string; name: string }>);
        } catch (err) {
            console.error('Failed to load VPN data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAdd = async () => {
        if (!formData.username || !formData.password || !formData.routerId) {
            alert('Please fill in Username, Password, and select a Router.');
            return;
        }
        try {
            await vpnApi.create(formData);
            setShowAddModal(false);
            setFormData({ username: '', password: '', fullName: '', protocol: 'L2TP', profile: 'default', localAddress: '', remoteAddress: '', routerId: '', service: 'l2tp' });
            fetchData();
        } catch (err: any) {
            console.error('Failed to create VPN user:', err);
            alert(err?.message || 'Failed to create VPN user.');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await vpnApi.delete(deleteId);
            setDeleteId(null);
            fetchData();
        } catch (err) {
            console.error('Failed to delete VPN user:', err);
        }
    };

    const filtered = vpnUsers.filter(u => {
        const matchSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchProtocol = protocolFilter === 'All' || u.protocol === protocolFilter;
        const matchStatus = statusFilter === 'All' || u.status === statusFilter;
        return matchSearch && matchProtocol && matchStatus;
    });

    const activeCount = vpnUsers.filter(u => u.status === 'Active').length;
    const connectedCount = vpnUsers.filter(u => u.uptime && u.uptime !== '—').length;

    return (
        <div>
            {deleteId && (
                <ConfirmDeleteModal
                    title="Delete VPN User"
                    message="Are you sure you want to delete this VPN user? Their connection will be terminated immediately."
                    onClose={() => setDeleteId(null)}
                    onConfirm={handleDelete}
                />
            )}

            {/* View Modal */}
            {viewUser && (
                <div className="modal-overlay" onClick={() => setViewUser(null)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title"><VpnKeyIcon fontSize="small" /> VPN User Details</h2>
                            <button className="modal-close" onClick={() => setViewUser(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: '1.4rem', fontWeight: 700,
                                }}>
                                    {viewUser.username.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{viewUser.username}</h3>
                                    <span className={`badge ${viewUser.status === 'Active' ? 'active' : 'expired'}`}>{viewUser.status}</span>
                                </div>
                            </div>
                            {[
                                ['Full Name', viewUser.fullName || '—'],
                                ['Protocol', viewUser.protocol],
                                ['Profile', viewUser.profile],
                                ['Server', viewUser.serverAddress || '—'],
                                ['Local Address', viewUser.localAddress || '—'],
                                ['Remote Address', viewUser.remoteAddress || '—'],
                                ['Router', viewUser.routerName],
                                ['Uptime', viewUser.uptime || '—'],
                                ['Data In', viewUser.bytesIn || '0 B'],
                                ['Data Out', viewUser.bytesOut || '0 B'],
                                ['Connected At', viewUser.connectedAt || 'Never'],
                                ['Created', viewUser.createdAt],
                            ].map(([label, value]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.88rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                                    <strong>{value}</strong>
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setViewUser(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title"><VpnKeyIcon fontSize="small" /> Add VPN User</h2>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Username <span className="required">*</span></label>
                                    <input className="form-input" placeholder="vpn-user001" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input className="form-input" placeholder="John Doe" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Password <span className="required">*</span></label>
                                    <input className="form-input" type="password" placeholder="Strong password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Protocol</label>
                                    <select className="form-select" value={formData.protocol} onChange={e => setFormData({ ...formData, protocol: e.target.value, service: e.target.value.toLowerCase() })}>
                                        <option value="L2TP">L2TP/IPsec</option>
                                        <option value="PPTP">PPTP</option>
                                        <option value="SSTP">SSTP</option>
                                        <option value="OpenVPN">OpenVPN</option>
                                        <option value="WireGuard">WireGuard</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Router <span className="required">*</span></label>
                                    <select className="form-select" value={formData.routerId} onChange={e => setFormData({ ...formData, routerId: e.target.value })}>
                                        <option value="">Select Router</option>
                                        {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Profile</label>
                                    <select className="form-select" value={formData.profile} onChange={e => setFormData({ ...formData, profile: e.target.value })}>
                                        <option value="default">default</option>
                                        <option value="default-encryption">default-encryption</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Local Address</label>
                                    <input className="form-input" placeholder="10.0.0.1" value={formData.localAddress} onChange={e => setFormData({ ...formData, localAddress: e.target.value })} />
                                    <div className="form-hint">VPN server-side tunnel IP</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Remote Address</label>
                                    <input className="form-input" placeholder="10.0.0.2" value={formData.remoteAddress} onChange={e => setFormData({ ...formData, remoteAddress: e.target.value })} />
                                    <div className="form-hint">Client-side tunnel IP</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAdd}>
                                <AddIcon fontSize="small" /> Create VPN User
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                        <VpnKeyIcon />
                    </div>
                    <div>
                        <h1 className="page-title">VPN Management</h1>
                        <p className="page-subtitle">Manage VPN tunnels, secrets and connected users</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-secondary" onClick={fetchData}><RefreshIcon fontSize="small" /> Refresh</button>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <AddIcon fontSize="small" /> Add VPN User
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                <div className="stat-card purple">
                    <div className="stat-card-label">Total VPN Users</div>
                    <div className="stat-card-value">{vpnUsers.length}</div>
                    <PersonIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card green">
                    <div className="stat-card-label">Active</div>
                    <div className="stat-card-value">{activeCount}</div>
                    <CheckCircleIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card blue">
                    <div className="stat-card-label">Connected Now</div>
                    <div className="stat-card-value">{connectedCount}</div>
                    <SpeedIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
                <div className="stat-card orange">
                    <div className="stat-card-label">Routers</div>
                    <div className="stat-card-value">{routers.length}</div>
                    <RouterIcon className="stat-card-icon" style={{ fontSize: 40 }} />
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <select className="select-field" value={protocolFilter} onChange={e => setProtocolFilter(e.target.value)}>
                            <option value="All">All Protocols</option>
                            <option>L2TP</option>
                            <option>PPTP</option>
                            <option>SSTP</option>
                            <option>OpenVPN</option>
                            <option>WireGuard</option>
                        </select>
                        <select className="select-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            <option>Active</option>
                            <option>Disabled</option>
                        </select>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="search-input">
                            <SearchIcon className="search-icon" />
                            <input placeholder="Search VPN users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Protocol</th>
                                <th>Profile</th>
                                <th>Local / Remote IP</th>
                                <th>Router</th>
                                <th>Status</th>
                                <th>Uptime</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading VPN users...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No VPN users found.</td></tr>
                            ) : filtered.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div className="user-avatar purple" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                                                {u.username.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{u.username}</div>
                                                <span className="cell-sub">{u.fullName || '—'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className="badge" style={{ background: u.protocol === 'L2TP' ? '#7c3aed22' : u.protocol === 'WireGuard' ? '#059669' + '22' : '#2196f322', color: u.protocol === 'L2TP' ? '#7c3aed' : u.protocol === 'WireGuard' ? '#059669' : '#2196f3', fontWeight: 600 }}>{u.protocol}</span></td>
                                    <td style={{ fontSize: '0.85rem' }}>{u.profile}</td>
                                    <td>
                                        <div style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                                            <div>{u.localAddress || '—'}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>{u.remoteAddress || '—'}</div>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>{u.routerName}</td>
                                    <td>
                                        <span className={`badge ${u.status === 'Active' ? 'active' : 'expired'}`}>
                                            {u.status === 'Active' ? <CheckCircleIcon style={{ fontSize: 12, marginRight: 4 }} /> : <CancelIcon style={{ fontSize: 12, marginRight: 4 }} />}
                                            {u.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.85rem', color: u.uptime && u.uptime !== '—' ? '#059669' : 'var(--text-muted)' }}>
                                        {u.uptime || '—'}
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon view" title="View" onClick={() => setViewUser(u)}>
                                                <VisibilityIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon edit" title="Copy Username" onClick={() => { navigator.clipboard.writeText(u.username); }}>
                                                <ContentCopyIcon style={{ fontSize: 16 }} />
                                            </button>
                                            <button className="btn-icon delete" title="Delete" onClick={() => setDeleteId(u.id)}>
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
                    <div className="pagination-info">Showing {filtered.length} of {vpnUsers.length} VPN users</div>
                </div>
            </div>
        </div>
    );
}
