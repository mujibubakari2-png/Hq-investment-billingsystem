import { useState, useEffect } from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import { usersApi } from '../api/client';
import type { SystemUser } from '../types';
import { formatDateTime } from '../utils/formatters';

export default function SystemUsers() {
    const [showAddUser, setShowAddUser] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [filterRoles, setFilterRoles] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [users, setUsers] = useState<SystemUser[]>([]);

    const defaultNewUser = {
        fullName: '',
        phone: '',
        email: '',
        city: '',
        subDistrict: '',
        ward: '',
        role: 'Admin',
        status: 'Active',
        username: '',
        password: '123456',
        sendNotification: "Don't Send"
    };
    const [newUser, setNewUser] = useState(defaultNewUser);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        try {
            setIsRefreshing(true);
            const data = await usersApi.list();
            setUsers(data as unknown as SystemUser[]);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            // Add a tiny delay so the refresh animation is visible even if local
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    useEffect(() => {
        fetchUsers();

        // Start the real-time clock for Status Update
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    const SESSION_TIMEOUT_MINUTES = 30;
    const isUserOnline = (lastLogin: string | null) => {
        if (!lastLogin) return false;
        return (new Date().getTime() - new Date(lastLogin).getTime()) < SESSION_TIMEOUT_MINUTES * 60000;
    };
    const onlineUsersCount = users.filter(u => isUserOnline(u.lastLogin)).length;

    const filtered = users.filter(u => {
        const matchesSearch = (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRoles === 'all' || u.role === filterRoles;
        const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
        try {
            await usersApi.delete(id);
            await fetchUsers();
        } catch (err: any) {
            alert(err.message || 'Failed to delete user. Please make sure you have sufficient permissions.');
        }
    };

    const handleEdit = (user: any) => {
        setEditingUserId(user.id);
        setNewUser({
            fullName: user.fullName || '',
            phone: user.phone || '',
            email: user.email || '',
            city: '', subDistrict: '', ward: '',
            role: user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'ADMIN' ? 'Admin' : user.role === 'AGENT' ? 'Agent' : user.role === 'VIEWER' ? 'Viewer' : user.role || 'Admin',
            status: user.status === 'ACTIVE' ? 'Active' : user.status === 'INACTIVE' ? 'Inactive' : user.status || 'Active',
            username: user.username || '',
            password: '', // Blank password implies no change
            sendNotification: "Don't Send"
        });
        setShowAddUser(true);
    };

    const handleView = (user: any) => {
        alert(
            `User Details:\n\n` +
            `Username: ${user.username || 'N/A'}\n` +
            `Email: ${user.email || 'N/A'}\n` +
            `Phone: ${user.phone || 'N/A'}\n` +
            `Role: ${user.role || 'N/A'}\n` +
            `Status: ${user.status || 'N/A'}\n` +
            `Last Login: ${formatDateTime(user.lastLogin) === 'N/A' ? 'Never' : formatDateTime(user.lastLogin)}`
        );
    };

    const handleSaveUser = async () => {
        try {
            setIsSaving(true);
            setError('');

            const payload: any = { ...newUser };
            if (editingUserId && !payload.password) {
                delete payload.password; // Do not send blank password when editing
            }

            if (editingUserId) {
                await usersApi.update(editingUserId, payload);
            } else {
                await usersApi.create(payload);
            }

            await fetchUsers();
            setShowAddUser(false);
            setEditingUserId(null);
            setNewUser({ ...defaultNewUser });
        } catch (err: any) {
            setError(err.message || 'Failed to save user');
        } finally {
            setIsSaving(false);
        }
    };

    if (showAddUser) {
        return (
            <div>
                <div className="grid-2 gap-24">
                    {/* Profile Section */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 16 }}>Profile</h3>
                        {error && <div style={{ color: 'red', marginBottom: 10, fontSize: '0.8rem' }}>{error}</div>}
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Full Name</label>
                            <input type="text" className="form-input" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Phone</label>
                            <input type="text" className="form-input" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Email</label>
                            <input type="email" className="form-input" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>City</label>
                                <input type="text" className="form-input" placeholder="City" value={newUser.city} onChange={e => setNewUser({ ...newUser, city: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sub District</label>
                                <input type="text" className="form-input" placeholder="Sub District" value={newUser.subDistrict} onChange={e => setNewUser({ ...newUser, subDistrict: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ward</label>
                                <input type="text" className="form-input" placeholder="Ward" value={newUser.ward} onChange={e => setNewUser({ ...newUser, ward: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* Credentials Section */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ color: 'var(--info)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 16 }}>Credentials</h3>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>User Type</label>
                            <select className="form-select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                <option>Viewer</option>
                                <option>Agent</option>
                                <option>Admin</option>
                                <option>Super Admin</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Username</label>
                            <input type="text" className="form-input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Password {editingUserId && "(Leave blank to keep current)"}</label>
                            <input type="password" className="form-input" placeholder={editingUserId ? "••••••••" : ""} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Status</label>
                            <select className="form-select" value={newUser.status} onChange={e => setNewUser({ ...newUser, status: e.target.value })}>
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Send Notification</label>
                            <select className="form-select" value={newUser.sendNotification} onChange={e => setNewUser({ ...newUser, sendNotification: e.target.value })}>
                                <option>Don't Send</option>
                                <option>By SMS</option>
                                <option>By WhatsApp</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, gap: 12 }}>
                    <button className="btn" style={{
                        background: '#f1f5f9', color: '#475569', fontWeight: 600,
                        padding: '10px 32px', fontSize: '0.95rem',
                    }} onClick={() => {
                        setShowAddUser(false);
                        setEditingUserId(null);
                        setNewUser({ ...defaultNewUser });
                    }}>
                        Cancel
                    </button>
                    <button className="btn" style={{
                        background: 'var(--primary)', color: '#fff', fontWeight: 700,
                        padding: '10px 32px', fontSize: '0.95rem',
                    }} onClick={handleSaveUser} disabled={isSaving}>
                        {isSaving ? 'Saving...' : (editingUserId ? 'Update User' : 'Save User')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Breadcrumb and Title */}
            <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Administration</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}> ♦ </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Real-time Session Management</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AdminPanelSettingsIcon /> User Management
                </h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={fetchUsers} disabled={isRefreshing} style={{
                        background: '#fff', color: '#e11d48', border: '1px solid #fecdd3',
                        fontWeight: 600, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4,
                        opacity: isRefreshing ? 0.7 : 1, cursor: isRefreshing ? 'wait' : 'pointer'
                    }}>
                        <RefreshIcon fontSize="small" style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button className="btn" style={{
                        background: '#16a34a', color: '#fff', fontWeight: 600,
                        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4,
                    }} onClick={() => setShowAddUser(true)}>
                        <AddIcon fontSize="small" /> Add New User
                    </button>
                </div>
            </div>

            {/* Online Status Bar */}
            <div style={{
                background: '#16a34a', borderRadius: 'var(--radius-sm)', padding: '6px 16px',
                color: '#fff', fontWeight: 600, fontSize: '0.8rem', textAlign: 'center', marginBottom: 4,
            }}>
                Online
            </div>
            <div style={{ marginBottom: 16 }}>
                <span style={{
                    display: 'inline-block', background: '#16a34a', color: '#fff',
                    padding: '2px 12px', borderRadius: '0 0 6px 6px', fontSize: '0.72rem', fontWeight: 500,
                }}>
                    {onlineUsersCount} Sessions
                </span>
            </div>

            {/* Stats Row */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 0, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginBottom: 20, background: '#fff',
            }}>
                <div style={{ textAlign: 'center', padding: '16px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Online Users</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{onlineUsersCount}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Active Sessions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{SESSION_TIMEOUT_MINUTES}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Session Timeout (min)</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e11d48' }}>{currentTime}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Status Update</div>
                </div>
            </div>



            {/* User Table */}
            <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
                        <AdminPanelSettingsIcon style={{ fontSize: 18 }} /> All Users
                        <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                            with real-time session monitoring
                        </span>
                    </h3>
                </div>

                {/* Filters Row */}
                <div style={{
                    padding: '10px 16px', borderBottom: '1px solid var(--border-light)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.82rem' }}>Show</span>
                        <select className="select-field" value={entriesPerPage} onChange={e => setEntriesPerPage(Number(e.target.value))} style={{ width: 60 }}>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                        </select>
                        <span style={{ fontSize: '0.82rem' }}>entries</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select className="select-field" value={filterRoles} onChange={e => setFilterRoles(e.target.value)} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            <option value="all">All Roles</option>
                            <option value="Super Admin">Super Admin</option>
                            <option value="Admin">Admin</option>
                            <option value="Agent">Agent</option>
                            <option value="Viewer">Viewer</option>
                        </select>
                        <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            <option value="all">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                        <input
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                fontSize: '0.8rem', padding: '4px 8px', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)', width: 120,
                            }}
                        />
                        <button style={{
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer',
                        }}>
                            <SearchIcon style={{ fontSize: 14 }} />
                        </button>
                    </div>
                </div>


                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>↕</th>
                                <th>Avatar</th>
                                <th>User</th>
                                <th>↕ Contact</th>
                                <th>Role</th>
                                <th>↕ Status</th>
                                <th>↕ Online Status</th>
                                <th>↕ Sessions</th>
                                <th>Last Activity</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(user => (
                                <tr key={user.id}>
                                    <td></td>
                                    <td>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%',
                                            background: '#e5e7eb', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>👤</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{user.username}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                📧 {user.email}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.82rem' }}>
                                            <div>📱 {user.phone}</div>
                                            <div>📧 {user.email}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontWeight: 600, fontSize: '0.72rem',
                                            background: '#7c3aed', color: '#fff',
                                        }}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontWeight: 500, fontSize: '0.72rem',
                                            background: user.status === 'Active' ? '#d1fae5' : '#fee2e2',
                                            color: user.status === 'Active' ? '#065f46' : '#dc2626',
                                        }}>
                                            {user.status === 'Active' ? '✓ Active' : '✕ Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontWeight: 500, fontSize: '0.72rem',
                                            background: isUserOnline(user.lastLogin) ? '#d1fae5' : '#fee2e2',
                                            color: isUserOnline(user.lastLogin) ? '#065f46' : '#dc2626',
                                        }}>
                                            {isUserOnline(user.lastLogin) ? '1 Online' : '0 Offline'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{isUserOnline(user.lastLogin) ? 1 : 0}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>SESSION</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <AccessTimeIcon style={{ fontSize: 14 }} /> {user.lastLogin ? (formatDateTime(user.lastLogin) === 'N/A' ? 'Never' : formatDateTime(user.lastLogin)) : 'Never Logged In'}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" style={{ background: '#f3f4f6' }} title="View" onClick={() => handleView(user)}>
                                                <VisibilityIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button className="btn-icon edit" title="Edit" onClick={() => handleEdit(user)}>
                                                <EditIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button
                                                className="btn-icon delete"
                                                title="Delete"
                                                onClick={() => handleDelete(user.id)}
                                            >
                                                <DeleteIcon style={{ fontSize: 14 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <div className="pagination-info">
                        Showing <span style={{ color: 'var(--primary)' }}>{filtered.length > 0 ? 1 : 0}</span> to <span style={{ color: 'var(--primary)' }}>{filtered.length}</span> of {users.length} entries
                    </div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn">Previous</button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">Next</button>
                    </div>
                </div>

                <div style={{ padding: '10px 16px', display: 'flex', gap: 4 }}>
                    <button className="pagination-btn">Prev</button>
                    <button className="pagination-btn active">1</button>
                    <button className="pagination-btn">Next</button>
                </div>
            </div>
        </div>
    );
}
