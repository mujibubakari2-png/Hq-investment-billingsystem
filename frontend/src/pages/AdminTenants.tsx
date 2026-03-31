import { useState, useEffect } from 'react';
import { adminTenantsApi, type Tenant } from '../api/client';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function AdminTenants() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const data = await adminTenantsApi.list();
            setTenants(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load tenants');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleConfirm = async (tenantId: string) => {
        if (!confirm('Are you sure you want to confirm this tenant? This will activate their account.')) return;
        try {
            await adminTenantsApi.confirm(tenantId);
            fetchTenants(); // Refresh list
        } catch (err: any) {
            alert(err.message || 'Failed to confirm tenant');
        }
    };

    const handleSuspend = async (tenantId: string) => {
        if (!confirm('Are you sure you want to suspend this tenant? They will no longer be able to log in.')) return;
        try {
            await adminTenantsApi.suspend(tenantId);
            fetchTenants(); // Refresh list
        } catch (err: any) {
            alert(err.message || 'Failed to suspend tenant');
        }
    };

    const filtered = tenants.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.email.toLowerCase().includes(search.toLowerCase()) ||
        t.phone.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
                <CircularProgress style={{ color: 'var(--teal)' }} />
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal)' }}>
                        <PersonAddIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Tenants Management</h1>
                        <p className="page-subtitle">Review, confirm, and manage all system tenants</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-outline" onClick={fetchTenants}>
                        <RefreshIcon fontSize="small" style={{ marginRight: 8 }} /> Refresh
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <SearchIcon style={{ color: 'var(--text-secondary)', fontSize: 20 }} />
                    <input 
                        type="text" 
                        placeholder="Search tenants by name, email or phone..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                    />
                </div>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: 16, padding: '0 10px' }}>{error}</div>}

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Company Name</th>
                            <th>Contact Info</th>
                            <th>Plan</th>
                            <th>Usage (Users/Clients)</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                                    No tenants found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(tenant => (
                                <tr key={tenant.id}>
                                    <td style={{ fontWeight: 600 }}>{tenant.name}</td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>{tenant.email}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tenant.phone}</div>
                                    </td>
                                    <td>
                                        <span className="badge badge-outline">{tenant.plan}</span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            {tenant.userCount} Users • {tenant.clientCount} Clients
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${tenant.status.toLowerCase()}`}>
                                            {tenant.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {tenant.status !== 'ACTIVE' && (
                                                <button 
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleConfirm(tenant.id)}
                                                    style={{ background: '#16a34a' }}
                                                >
                                                    <CheckCircleIcon fontSize="inherit" style={{ marginRight: 4 }} />
                                                    Confirm
                                                </button>
                                            )}
                                            {tenant.status === 'ACTIVE' && (
                                                <button 
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleSuspend(tenant.id)}
                                                >
                                                    <BlockIcon fontSize="inherit" style={{ marginRight: 4 }} />
                                                    Suspend
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
