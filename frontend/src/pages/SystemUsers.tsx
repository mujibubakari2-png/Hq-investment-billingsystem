import { useState } from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

export default function SystemUsers() {
    const [showAddUser, setShowAddUser] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [filterUsers, setFilterUsers] = useState('all');
    const [filterRoles, setFilterRoles] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const users = [
        {
            id: '1', name: 'Mujibu rashid bakari', phone: '0621085215',
            email: 'mujtbubakari2@gmail.com', contact: 'mujtbubakari2@gmail.com',
            role: 'SuperAdmin', status: 'Active', onlineStatus: 'Offline',
            sessions: 0, lastActivity: '43 minutes ago',
        },
    ];

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showAddUser) {
        return (
            <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Profile Section */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 16 }}>Profile</h3>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Full Name</label>
                            <input type="text" className="form-input" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Phone</label>
                            <input type="text" className="form-input" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Email</label>
                            <input type="email" className="form-input" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>City</label>
                                <input type="text" className="form-input" placeholder="City" />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sub District</label>
                                <input type="text" className="form-input" placeholder="Sub District" />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ward</label>
                                <input type="text" className="form-input" placeholder="Ward" />
                            </div>
                        </div>
                    </div>

                    {/* Credentials Section */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ color: 'var(--info)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 16 }}>Credentials</h3>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>User Type</label>
                            <select className="form-select">
                                <option>Report Viewer</option>
                                <option>Admin</option>
                                <option>Super Admin</option>
                                <option>Support Agent</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Username</label>
                            <input type="text" className="form-input" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Password</label>
                            <input type="password" className="form-input" defaultValue="123456" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Send Notification</label>
                            <select className="form-select">
                                <option>Don't Send</option>
                                <option>By SMS</option>
                                <option>By WhatsApp</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                    <button className="btn" style={{
                        background: 'var(--primary)', color: '#fff', fontWeight: 700,
                        padding: '10px 32px', fontSize: '0.95rem',
                    }} onClick={() => setShowAddUser(false)}>
                        Save Changes
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
                    <button className="btn" style={{
                        background: '#fff', color: '#e11d48', border: '1px solid #fecdd3',
                        fontWeight: 600, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <RefreshIcon fontSize="small" /> Refresh
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
                    0 Sessions
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
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>0</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Active Sessions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 0', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>min</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Session Timeout</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e11d48' }}>20:04:46</div>
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
                        <select className="select-field" value={filterUsers} onChange={e => setFilterUsers(e.target.value)} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            <option value="all">All Users</option>
                        </select>
                        <select className="select-field" value={filterRoles} onChange={e => setFilterRoles(e.target.value)} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            <option value="all">All Roles</option>
                            <option value="superadmin">SuperAdmin</option>
                            <option value="admin">Admin</option>
                        </select>
                        <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <input placeholder="Search users..." style={{
                            fontSize: '0.8rem', padding: '4px 8px', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', width: 120,
                        }} />
                        <button style={{
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer',
                        }}>
                            <SearchIcon style={{ fontSize: 14 }} />
                        </button>
                    </div>
                </div>

                {/* Extra Show entries */}
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.82rem' }}>Show</span>
                    <select className="select-field" style={{ width: 60 }}>
                        <option>10</option>
                        <option>25</option>
                    </select>
                    <span style={{ fontSize: '0.82rem' }}>entries</span>
                    <div style={{ marginLeft: 'auto' }}>
                        <span style={{ fontSize: '0.82rem', marginRight: 6 }}>Search:</span>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{
                            fontSize: '0.8rem', padding: '4px 8px', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', width: 120,
                        }} />
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
                                    <td>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%',
                                            background: '#e5e7eb', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>👤</span>
                                        </div>
                                    </td>
                                    <td></td>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{user.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                📧 {user.email}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.82rem' }}>
                                            <div>📱 {user.phone}</div>
                                            <div>📧 {user.contact}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontWeight: 600, fontSize: '0.72rem',
                                            background: '#7c3aed', color: '#fff',
                                        }}>
                                            SuperAdmin
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontWeight: 500, fontSize: '0.72rem',
                                            background: '#d1fae5', color: '#065f46',
                                        }}>
                                            ✓ Active
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 4, fontWeight: 500, fontSize: '0.72rem',
                                            background: '#fee2e2', color: '#dc2626',
                                        }}>
                                            0 Offline
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>0</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>SESSION</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <AccessTimeIcon style={{ fontSize: 14 }} /> {user.lastActivity}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" style={{ background: '#f3f4f6' }} title="View">
                                                <VisibilityIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button className="btn-icon edit" title="Edit">
                                                <EditIcon style={{ fontSize: 14 }} />
                                            </button>
                                            <button className="btn-icon delete" title="Delete">
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
                    <div className="pagination-info">Showing <span style={{ color: 'var(--primary)' }}>1</span> to <span style={{ color: 'var(--primary)' }}>1</span> of 1 entries</div>
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
