import { useState, useEffect } from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { systemUsersApi } from '../api';
import type { SystemUser as SharedSystemUser } from '../types';
import { formatDateTime } from '../utils/formatters';

type SystemUser = Omit<SharedSystemUser, 'lastLogin' | 'createdAt' | 'phone' | 'fullName'> & {
    fullName?: string;
    rawRole?: string;
    status: SharedSystemUser['status'];
    role: SharedSystemUser['role'];
    phone?: string;
    lastLogin?: string | null;
    createdAt?: string | null;
};

interface UsersMeta {
    subUserCount: number;
    subUserLimit: number;
    planName: string | null;
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
    'Super Admin': { bg: '#ede9fe', color: '#6d28d9' },
    'Admin':       { bg: '#dbeafe', color: '#1d4ed8' },
    'Agent':       { bg: '#d1fae5', color: '#065f46' },
    'Viewer':      { bg: '#fef3c7', color: '#92400e' },
};

const SESSION_TIMEOUT_MINUTES = 30;

function isUserOnline(lastLogin: string | null | undefined): boolean {
    if (!lastLogin) return false;
    return (Date.now() - new Date(lastLogin).getTime()) < SESSION_TIMEOUT_MINUTES * 60000;
}

const defaultNewUser = {
    fullName:     '',
    phone:        '',
    email:        '',
    role:         'Agent',
    status:       'Active',
    username:     '',
};

export default function SystemUsers() {
    const [showAddUser, setShowAddUser]   = useState(false);
    const [searchTerm, setSearchTerm]     = useState('');
    const [filterRole, setFilterRole]     = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [users, setUsers]       = useState<SystemUser[]>([]);
    const [meta, setMeta]         = useState<UsersMeta | null>(null);
    const [newUser, setNewUser]   = useState({ ...defaultNewUser });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError]       = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    const fetchUsers = async () => {
        try {
            setIsRefreshing(true);
            const data = await systemUsersApi.list();
            const metaRecord = data.meta as Record<string, unknown> | undefined;
            const mappedUsers = Array.isArray(data.users)
                ? (data.users as Array<Record<string, unknown>>).map((user): SystemUser => {
                    const roleValue = typeof user.role === 'string' ? user.role : 'Agent';
                    const normalizedRole = roleValue === 'Super Admin' || roleValue === 'Admin' || roleValue === 'Agent' || roleValue === 'Viewer'
                        ? roleValue
                        : 'Agent';
                    const statusValue = typeof user.status === 'string' ? user.status : 'Active';
                    return {
                        id: String(user.id ?? ''),
                        username: String(user.username ?? ''),
                        fullName: typeof user.fullName === 'string' ? user.fullName : undefined,
                        email: String(user.email ?? ''),
                        role: normalizedRole as SystemUser['role'],
                        rawRole: typeof user.rawRole === 'string' ? user.rawRole : undefined,
                        status: statusValue as SystemUser['status'],
                        phone: typeof user.phone === 'string' ? user.phone : undefined,
                        lastLogin: typeof user.lastLogin === 'string' ? user.lastLogin : null,
                        createdAt: typeof user.createdAt === 'string' ? user.createdAt : null,
                    };
                })
                : [];
            setUsers(mappedUsers);
            setMeta(metaRecord ? {
                subUserCount: Number(metaRecord.subUserCount ?? 0),
                subUserLimit: Number(metaRecord.subUserLimit ?? 0),
                planName: typeof metaRecord.planName === 'string' ? metaRecord.planName : null,
            } : null);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    useEffect(() => {
        fetchUsers();
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    const subUsers = users.filter(u => u.rawRole !== 'SUPER_ADMIN' && u.role !== 'Super Admin');
    const onlineCount = users.filter(u => isUserOnline(u.lastLogin)).length;

    const filtered = users.filter(u => {
        const matchSearch = (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole   = filterRole === 'all' || u.role === filterRole;
        const matchStatus = filterStatus === 'all' || u.status === filterStatus;
        return matchSearch && matchRole && matchStatus;
    });

    const handleDelete = async (id: string, role: string) => {
        if (role === 'Super Admin') {
            alert('The Super Admin account owner cannot be deleted.');
            return;
        }
        if (!window.confirm('Delete this user? This cannot be undone.')) return;
        try {
            await systemUsersApi.delete(id);
            await fetchUsers();
        } catch (err: any) {
            alert(err.message || 'Failed to delete user.');
        }
    };

    const handleEdit = (user: SystemUser) => {
        setEditingId(user.id);
        setNewUser({
            fullName: user.fullName || '',
            phone:    user.phone || '',
            email:    user.email || '',
            role:     user.role || 'Agent',
            status:   user.status || 'Active',
            username: user.username || '',
        });
        setError('');
        setSuccessMsg('');
        setShowAddUser(true);
    };

    const handleView = (user: SystemUser) => {
        alert(
            `User Details\n\n` +
            `Name:       ${user.fullName || 'N/A'}\n` +
            `Username:   ${user.username || 'N/A'}\n` +
            `Email:      ${user.email || 'N/A'}\n` +
            `Phone:      ${user.phone || 'N/A'}\n` +
            `Role:       ${user.role || 'N/A'}\n` +
            `Status:     ${user.status || 'N/A'}\n` +
            `Last Login: ${user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}`
        );
    };

    const handleSaveUser = async () => {
        setIsSaving(true);
        setError('');
        setSuccessMsg('');
        try {
            if (!newUser.username || !newUser.email) {
                setError('Username and email are required.');
                setIsSaving(false);
                return;
            }

            if (editingId) {
                await systemUsersApi.update(editingId, newUser);
                setSuccessMsg('User updated successfully.');
            } else {
                const res: any = await systemUsersApi.create(newUser);
                setSuccessMsg(res?.message || 'User created. A welcome email with login credentials has been sent.');
            }

            await fetchUsers();

            // Keep the form open briefly to show success message, then close
            setTimeout(() => {
                setShowAddUser(false);
                setEditingId(null);
                setNewUser({ ...defaultNewUser });
                setSuccessMsg('');
            }, 2500);
        } catch (err: any) {
            setError(err.message || 'Failed to save user. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const limitPct = meta ? Math.min(100, Math.round((meta.subUserCount / meta.subUserLimit) * 100)) : 0;
    const limitReached = meta ? meta.subUserCount >= meta.subUserLimit : false;

    // ── Add / Edit Form ─────────────────────────────────────────────────────────
    if (showAddUser) {
        return (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <button
                        onClick={() => { setShowAddUser(false); setEditingId(null); setNewUser({ ...defaultNewUser }); setError(''); }}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                    >
                        ← Back
                    </button>
                    <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>
                        {editingId ? 'Edit User' : 'Add New Team Member'}
                    </h2>
                </div>

                {/* Temp password info banner — only on create */}
                {!editingId && (
                    <div style={{
                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
                        padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                        <InfoOutlinedIcon style={{ color: '#3b82f6', fontSize: 20, flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <div style={{ fontWeight: 600, color: '#1d4ed8', fontSize: '0.88rem' }}>Temporary Password Will Be Sent</div>
                            <div style={{ fontSize: '0.82rem', color: '#3b82f6', marginTop: 2 }}>
                                A secure temporary password will be auto-generated and emailed to the user.
                                They will be prompted to change it on first login.
                            </div>
                        </div>
                    </div>
                )}

                {/* User limit warning */}
                {!editingId && limitReached && (
                    <div style={{
                        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                        padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontWeight: 600, fontSize: '0.88rem',
                    }}>
                        ⚠️ User limit reached ({meta?.subUserCount}/{meta?.subUserLimit} on {meta?.planName} plan).
                        Please upgrade your plan to add more team members.
                    </div>
                )}

                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.85rem' }}>
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>
                        ✅ {successMsg}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    {/* Profile Card */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 18, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                            👤 Profile Information
                        </h3>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label className="form-label">Full Name</label>
                            <input type="text" className="form-input" value={newUser.fullName}
                                onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                placeholder="e.g. John Mwangi" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label className="form-label">Phone Number</label>
                            <input type="text" className="form-input" value={newUser.phone}
                                onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                                placeholder="e.g. 0712345678" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Email Address <span style={{ color: '#e11d48' }}>*</span></label>
                            <input type="email" className="form-input" value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                placeholder="user@example.com" />
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Temporary password will be sent to this email
                            </div>
                        </div>
                    </div>

                    {/* Credentials Card */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ color: 'var(--info, #0ea5e9)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 18, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                            🔑 Credentials & Role
                        </h3>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label className="form-label">Username <span style={{ color: '#e11d48' }}>*</span></label>
                            <input type="text" className="form-input" value={newUser.username}
                                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                placeholder="e.g. johnmwangi" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label className="form-label">Role <span style={{ color: '#e11d48' }}>*</span></label>
                            <select className="form-select" value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                {/* SUPER_ADMIN cannot be created here — only 1 per tenant */}
                                <option value="Admin">Admin — Full access (no billing/settings)</option>
                                <option value="Agent">Agent — Operational access</option>
                                <option value="Viewer">Viewer — Same as Admin/Agent operational access</option>
                            </select>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Super Admin is the account owner. Sub-users cannot be promoted to Super Admin.
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Status</label>
                            <select className="form-select" value={newUser.status}
                                onChange={e => setNewUser({ ...newUser, status: e.target.value })}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 12 }}>
                    <button
                        onClick={() => { setShowAddUser(false); setEditingId(null); setNewUser({ ...defaultNewUser }); setError(''); }}
                        style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600, padding: '10px 28px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveUser}
                        disabled={isSaving || (!editingId && limitReached)}
                        style={{
                            background: (!editingId && limitReached) ? '#9ca3af' : 'var(--primary)',
                            color: '#fff', fontWeight: 700, padding: '10px 28px', borderRadius: 8,
                            border: 'none', cursor: isSaving ? 'wait' : 'pointer', fontSize: '0.95rem',
                        }}
                    >
                        {isSaving ? 'Saving...' : editingId ? 'Update User' : 'Create User & Send Email'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Main List View ───────────────────────────────────────────────────────────
    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        Administration ♦ Team Management
                    </div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <AdminPanelSettingsIcon /> System Users
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={fetchUsers} disabled={isRefreshing} style={{
                        background: '#fff', color: '#e11d48', border: '1px solid #fecdd3',
                        fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem',
                    }}>
                        <RefreshIcon fontSize="small" style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                        onClick={() => setShowAddUser(true)}
                        disabled={limitReached}
                        title={limitReached ? `User limit reached (${meta?.subUserCount}/${meta?.subUserLimit})` : 'Add new team member'}
                        style={{
                            background: limitReached ? '#9ca3af' : '#16a34a',
                            color: '#fff', fontWeight: 600, padding: '7px 16px', borderRadius: 8,
                            border: 'none', cursor: limitReached ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem',
                        }}
                    >
                        <AddIcon fontSize="small" /> Add User
                    </button>
                </div>
            </div>

            {/* User Limit Bar */}
            {meta && (
                <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <GroupIcon style={{ color: 'var(--primary)', fontSize: 22 }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Team Members ({meta.planName} Plan)
                            </span>
                            <span style={{ fontSize: '0.83rem', fontWeight: 700, color: limitReached ? '#dc2626' : 'var(--primary)' }}>
                                {meta.subUserCount} / {meta.subUserLimit}
                            </span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                            <div style={{
                                width: `${limitPct}%`, height: '100%', borderRadius: 99,
                                background: limitPct >= 100 ? '#dc2626' : limitPct >= 80 ? '#f59e0b' : '#16a34a',
                                transition: 'width 0.4s ease',
                            }} />
                        </div>
                    </div>
                    {limitReached && (
                        <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, background: '#fef2f2', padding: '3px 10px', borderRadius: 20, border: '1px solid #fecaca' }}>
                            Limit reached — upgrade plan
                        </span>
                    )}
                </div>
            )}

            {/* Stats Row */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 0, border: '1px solid var(--border-light)', borderRadius: 10,
                overflow: 'hidden', marginBottom: 20, background: '#fff',
            }}>
                <div style={{ textAlign: 'center', padding: '14px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{users.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Users</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#16a34a' }}>{onlineCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Online Now</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f59e0b' }}>{subUsers.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sub-Users</div>
                </div>
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e11d48', letterSpacing: '0.5px' }}>{currentTime}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Server Time</div>
                </div>
            </div>

            {/* Table Card */}
            <div className="card">
                {/* Filters */}
                <div style={{
                    padding: '10px 16px', borderBottom: '1px solid var(--border-light)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: 8,
                }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem' }}>
                        <AdminPanelSettingsIcon style={{ fontSize: 18 }} /> All Team Members
                    </h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                            style={{ fontSize: '0.8rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
                            <option value="all">All Roles</option>
                            <option value="Super Admin">Super Admin</option>
                            <option value="Admin">Admin</option>
                            <option value="Agent">Agent</option>
                            <option value="Viewer">Viewer</option>
                        </select>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            style={{ fontSize: '0.8rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
                            <option value="all">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                        <div style={{ position: 'relative' }}>
                            <SearchIcon style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-muted)' }} />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search users..."
                                style={{
                                    paddingLeft: 26, fontSize: '0.8rem', padding: '5px 8px 5px 26px',
                                    border: '1px solid var(--border)', borderRadius: 6, width: 140, background: '#fff',
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Avatar</th>
                                <th>User</th>
                                <th>Contact</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Session</th>
                                <th>Last Activity</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.85rem' }}>
                                        No users found
                                    </td>
                                </tr>
                            )}
                            {filtered.map(user => {
                                const online = isUserOnline(user.lastLogin);
                                const roleStyle = ROLE_COLORS[user.role] || { bg: '#f3f4f6', color: '#374151' };
                                const initials = (user.fullName || user.username || '?')
                                    .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                                const isSuperAdmin = user.role === 'Super Admin';

                                return (
                                    <tr key={user.id}>
                                        <td>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: roleStyle.bg, color: roleStyle.color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: '0.8rem',
                                            }}>{initials}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{user.fullName || user.username}</div>
                                            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>@{user.username}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.8rem' }}>
                                                {user.email && <div>✉ {user.email}</div>}
                                                {user.phone && <div>📱 {user.phone}</div>}
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 20, fontWeight: 600, fontSize: '0.72rem',
                                                background: roleStyle.bg, color: roleStyle.color,
                                            }}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 20, fontWeight: 500, fontSize: '0.72rem',
                                                background: user.status === 'Active' ? '#d1fae5' : '#fee2e2',
                                                color: user.status === 'Active' ? '#065f46' : '#dc2626',
                                            }}>
                                                {user.status === 'Active' ? '✓ Active' : '✕ Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 20, fontWeight: 500, fontSize: '0.72rem',
                                                background: online ? '#d1fae5' : '#f3f4f6',
                                                color: online ? '#065f46' : '#9ca3af',
                                            }}>
                                                {online ? '🟢 Online' : '⚪ Offline'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                <AccessTimeIcon style={{ fontSize: 13 }} />
                                                {user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" style={{ background: '#f3f4f6' }} title="View details" onClick={() => handleView(user)}>
                                                    <VisibilityIcon style={{ fontSize: 14 }} />
                                                </button>
                                                <button className="btn-icon edit" title="Edit user" onClick={() => handleEdit(user)}>
                                                    <EditIcon style={{ fontSize: 14 }} />
                                                </button>
                                                {!isSuperAdmin && (
                                                    <button className="btn-icon delete" title="Delete user"
                                                        onClick={() => handleDelete(user.id, user.role)}>
                                                        <DeleteIcon style={{ fontSize: 14 }} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <div className="pagination-info">
                        Showing {filtered.length > 0 ? 1 : 0}–{filtered.length} of {users.length} users
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
