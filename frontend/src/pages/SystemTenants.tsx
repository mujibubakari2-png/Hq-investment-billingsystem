import { useState, useEffect } from 'react';
import BusinessIcon from '@mui/icons-material/Business';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExtensionIcon from '@mui/icons-material/Extension';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useNavigate } from 'react-router-dom';
import { superAdminTenantsApi, adminInvoicesApi } from '../api/client';
import { formatExactDate, formatDate } from '../utils/formatters';

export default function SystemTenants() {
    const navigate = useNavigate();
    const [tenants, setTenants] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [extendTarget, setExtendTarget] = useState<{ id: string; name: string; expiresAt?: string } | null>(null);
    const [extendMonths, setExtendMonths] = useState(1);

    const fetchTenants = async () => {
        try {
            setIsLoading(true);
            const data = await superAdminTenantsApi.list();
            setTenants(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load tenants');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleApprove = async (id: string) => {
        if (!window.confirm("Approve this tenant account and start their 10-day trial?")) return;
        try {
            await superAdminTenantsApi.approve(id);
            alert("Tenant successfully approved! Trial period started.");
            fetchTenants();
        } catch (err: any) {
            alert(err.message || "Failed to approve tenant.");
        }
    };

    const handleSuspend = async (id: string, name: string) => {
        if (!window.confirm(`Suspend tenant "${name}"? They will lose access immediately.`)) return;
        try {
            await superAdminTenantsApi.action(id, 'suspend');
            fetchTenants();
        } catch (err: any) {
            alert(err.message || "Failed to suspend tenant.");
        }
    };

    const handleReactivate = async (id: string) => {
        if (!window.confirm("Reactivate this tenant account?")) return;
        try {
            await superAdminTenantsApi.action(id, 'reactivate');
            fetchTenants();
        } catch (err: any) {
            alert(err.message || "Failed to reactivate tenant.");
        }
    };

    const handleExtend = async () => {
        if (!extendTarget) return;
        try {
            const res = await adminInvoicesApi.extend(extendTarget.id, extendMonths);
            alert(res.message || 'License extended successfully!');
            setExtendTarget(null);
            fetchTenants();
        } catch (err: any) {
            alert(err.message || 'Failed to extend license.');
        }
    };

    // Calculate preview date for display
    const previewExpiry = (() => {
        const base = extendTarget?.expiresAt ? new Date(extendTarget.expiresAt) : new Date();
        const now = new Date();
        const from = base < now ? now : base;
        const preview = new Date(from);
        preview.setMonth(preview.getMonth() + extendMonths);
        return preview;
    })();

    const pendingTenants = tenants.filter(t => t.status === 'PENDING_APPROVAL');
    const activeTenants = tenants.filter(t => t.status !== 'PENDING_APPROVAL');



    return (
        <div>
            <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>System Administration</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}> ♦ </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Registered Tenants</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BusinessIcon /> Manage Tenants
                </h1>
                <button className="btn btn-secondary" onClick={fetchTenants} disabled={isLoading}>
                    <RefreshIcon fontSize="small" /> {isLoading ? 'Refreshing...' : 'Refresh Data'}
                </button>
            </div>
            
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 16px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--info)', marginBottom: 8 }}>Pending Approval ({pendingTenants.length})</h2>
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Registered On</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No accounts waiting for approval.</td>
                                </tr>
                            ) : pendingTenants.map((t: any) => (
                                <tr key={t.id} style={{ background: '#fffbeb' }}>
                                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                                    <td>{t.email}</td>
                                    <td>{t.phone || 'N/A'}</td>
                                    <td>{formatExactDate(t.createdAt)}</td>
                                    <td>
                                        <button className="btn" style={{ background: '#16a34a', color: '#fff', padding: '4px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleApprove(t.id)}>
                                            <CheckCircleIcon fontSize="small" /> Approve & Activate
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>All Existing Tenants</h2>
            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Primary Admin</th>
                                <th>Email</th>
                                <th>Plan</th>
                                <th>Status</th>
                                <th>Registered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeTenants.map((t: any) => (
                                <tr key={t.id}>
                                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                                    <td>{t.primaryUser}</td>
                                    <td>{t.email}</td>
                                    <td>{t.planName || '—'}</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                                            background: t.status === 'ACTIVE' ? '#d1fae5' : t.status === 'TRIALLING' ? '#dbeafe' : '#fee2e2',
                                            color: t.status === 'ACTIVE' ? '#065f46' : t.status === 'TRIALLING' ? '#1e40af' : '#dc2626'
                                        }}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td>{formatExactDate(t.createdAt)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            <button className="btn" style={{ background: '#0ea5e9', color: '#fff', padding: '3px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 3 }}
                                                onClick={() => navigate(`/dashboard?tenantId=${t.id}`)}>
                                                <DashboardIcon style={{ fontSize: 14 }} /> Dashboard
                                            </button>
                                            <button className="btn" style={{ background: '#7c3aed', color: '#fff', padding: '3px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 3 }}
                                                onClick={() => { setExtendTarget({ id: t.id, name: t.name, expiresAt: t.licenseExpiresAt || t.trialEnd }); setExtendMonths(1); }}>
                                                <ExtensionIcon style={{ fontSize: 14 }} /> Extend
                                            </button>
                                            {t.status === 'SUSPENDED' ? (
                                                <button className="btn" style={{ background: '#16a34a', color: '#fff', padding: '3px 10px', fontSize: '0.78rem' }} onClick={() => handleReactivate(t.id)}>
                                                    Reactivate
                                                </button>
                                            ) : (
                                                <button className="btn" style={{ background: '#dc2626', color: '#fff', padding: '3px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 3 }} onClick={() => handleSuspend(t.id, t.name)}>
                                                    <BlockIcon style={{ fontSize: 14 }} /> Suspend
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Extend License Modal */}
            {extendTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="card" style={{ maxWidth: 420, width: '100%', padding: '2rem', boxShadow: 'var(--shadow-md)' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>Extend License</h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            {extendTarget.name} — current expiry: <strong>{extendTarget.expiresAt ? formatDate(extendTarget.expiresAt) : 'Not set'}</strong>
                        </p>

                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>Extend by:</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1.25rem' }}>
                            {[1, 3, 6, 12].map(m => (
                                <button key={m} onClick={() => setExtendMonths(m)}
                                    style={{ padding: '10px 0', borderRadius: 8, border: `2px solid ${extendMonths === m ? '#7c3aed' : 'var(--border-light)'}`,
                                        background: extendMonths === m ? '#f5f3ff' : 'transparent', color: extendMonths === m ? '#7c3aed' : 'var(--text-primary)',
                                        fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                                    {m} {m === 1 ? 'mo' : 'mos'}
                                </button>
                            ))}
                        </div>

                        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 600 }}>NEW EXPIRY DATE (auto-calculated)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>{previewExpiry.toDateString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Extends from {extendTarget.expiresAt ? 'current expiry' : 'today'}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#7c3aed', color: 'white' }} onClick={handleExtend}>
                                Confirm Extension
                            </button>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setExtendTarget(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
