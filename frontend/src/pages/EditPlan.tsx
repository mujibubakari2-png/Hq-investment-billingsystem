import { useState, useEffect } from 'react';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InfoIcon from '@mui/icons-material/Info';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SyncIcon from '@mui/icons-material/Sync';
import { useNavigate, useParams } from 'react-router-dom';
import { subscriptionsApi, packagesApi, routersApi } from '../api/client';

interface SubscriptionDetail {
    id: string;
    clientId: string;
    packageId: string;
    routerId: string | null;
    status: string;
    method: string | null;
    activatedAt: string;
    expiresAt: string;
    onlineStatus: string | null;
    syncStatus: string | null;
    client: {
        id: string;
        username: string;
        fullName: string;
        phone: string | null;
        email: string | null;
        serviceType: string;
        macAddress: string | null;
        device: string | null;
    };
    package: {
        id: string;
        name: string;
        type: string;
        price: number;
        duration: number;
        durationUnit: string;
    };
    router: {
        id: string;
        name: string;
    } | null;
}

interface PkgOption {
    id: string;
    name: string;
    type: string;
    price: number;
    duration: number;
    durationUnit: string;
    uploadSpeed: number;
    uploadUnit: string;
    downloadSpeed: number;
    downloadUnit: string;
}

interface RouterOption {
    id: string;
    name: string;
}

export default function EditPlan() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Subscription data
    const [sub, setSub] = useState<SubscriptionDetail | null>(null);
    const [packages, setPackages] = useState<PkgOption[]>([]);
    const [routers, setRouters] = useState<RouterOption[]>([]);

    // Editable fields
    const [packageId, setPackageId] = useState('');
    const [routerId, setRouterId] = useState('');
    const [status, setStatus] = useState('ACTIVE');
    const [method, setMethod] = useState('');
    const [expiresDate, setExpiresDate] = useState('');
    const [expiresTime, setExpiresTime] = useState('');
    const [activatedDate, setActivatedDate] = useState('');
    const [activatedTime, setActivatedTime] = useState('');

    // Load subscription + packages + routers
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setError(null);

        Promise.all([
            subscriptionsApi.list({ page: '1', limit: '1000' }),
            packagesApi.list(),
            routersApi.list(),
            // Also fetch the specific subscription detail
            fetch(`/api/subscriptions/${id}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            }).then(r => r.json()),
        ])
            .then(([, pkgs, rtrs, subData]) => {
                setPackages(pkgs as unknown as PkgOption[]);
                setRouters(rtrs as unknown as RouterOption[]);

                if (subData?.error) {
                    setError(subData.error);
                    return;
                }

                setSub(subData as SubscriptionDetail);

                // Populate form fields
                setPackageId(subData.packageId || '');
                setRouterId(subData.routerId || '');
                setStatus(subData.status || 'ACTIVE');
                setMethod(subData.method || '');

                // Parse dates
                if (subData.activatedAt) {
                    const d = new Date(subData.activatedAt);
                    setActivatedDate(d.toISOString().split('T')[0]);
                    setActivatedTime(d.toTimeString().slice(0, 8));
                }
                if (subData.expiresAt) {
                    const d = new Date(subData.expiresAt);
                    setExpiresDate(d.toISOString().split('T')[0]);
                    setExpiresTime(d.toTimeString().slice(0, 8));
                }
            })
            .catch((err) => {
                console.error('Failed to load edit plan data:', err);
                setError('Failed to load subscription data. Please try again.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Build the expires datetime
            const expiresAt = expiresDate && expiresTime
                ? new Date(`${expiresDate}T${expiresTime}`).toISOString()
                : undefined;

            await subscriptionsApi.update(id, {
                packageId,
                routerId: routerId || undefined,
                status,
                method: method || undefined,
                expiresAt,
            });

            setSuccess('Subscription updated successfully!');
            setTimeout(() => {
                navigate(-1);
            }, 1500);
        } catch (err: any) {
            console.error('Failed to save:', err);
            setError(err.message || 'Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Auto-calculate new expiry when package changes
    const handlePackageChange = (newPkgId: string) => {
        setPackageId(newPkgId);
        const pkg = packages.find(p => p.id === newPkgId);
        if (pkg && activatedDate) {
            const start = new Date(`${activatedDate}T${activatedTime || '00:00:00'}`);
            let ms = 0;
            switch (pkg.durationUnit) {
                case 'MINUTES': ms = pkg.duration * 60 * 1000; break;
                case 'HOURS': ms = pkg.duration * 60 * 60 * 1000; break;
                case 'DAYS': ms = pkg.duration * 24 * 60 * 60 * 1000; break;
                case 'MONTHS': ms = pkg.duration * 30 * 24 * 60 * 60 * 1000; break;
            }
            const newExpiry = new Date(start.getTime() + ms);
            setExpiresDate(newExpiry.toISOString().split('T')[0]);
            setExpiresTime(newExpiry.toTimeString().slice(0, 8));
        }
    };

    const selectedPkg = packages.find(p => p.id === packageId);

    if (loading) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <SyncIcon className="spin" style={{ fontSize: 32, marginBottom: 12 }} />
                <div>Loading subscription details...</div>
            </div>
        );
    }

    if (error && !sub) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ color: 'var(--danger)', fontSize: '1.1rem', marginBottom: 16 }}>⚠️ {error}</div>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                    <ArrowBackIcon fontSize="small" /> Go Back
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                        <EditNoteIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Edit Subscription</h1>
                        <p className="page-subtitle">
                            Modify subscription for <strong>{sub?.client?.username || 'N/A'}</strong>
                        </p>
                    </div>
                </div>
                <div className="page-header-right">
                    <div className="breadcrumb">
                        <a href="/">Dashboard</a> <span>/</span>{' '}
                        <a href="/active-subscribers">Subscribers</a> <span>/</span> Edit
                    </div>
                </div>
            </div>

            {/* Status Messages */}
            {error && (
                <div style={{
                    padding: '12px 16px', marginBottom: 16, borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                    fontSize: '0.9rem',
                }}>
                    ⚠️ {error}
                </div>
            )}
            {success && (
                <div style={{
                    padding: '12px 16px', marginBottom: 16, borderRadius: 8,
                    background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a',
                    fontSize: '0.9rem',
                }}>
                    ✅ {success}
                </div>
            )}

            {/* Info Box */}
            <div className="info-box">
                <div className="info-box-title">
                    <InfoIcon fontSize="small" /> Instructions
                </div>
                <ul>
                    <li>Change the package to switch the customer's plan</li>
                    <li>Adjust the expiry date to extend or shorten the subscription</li>
                    <li>Changes will take effect immediately after saving</li>
                    <li>If the router is connected, the user profile will be updated on the MikroTik</li>
                </ul>
            </div>

            {/* Form Card */}
            <div className="card">
                <div className="card-body">
                    {/* Customer Information (read-only) */}
                    <div className="form-section-title">
                        <PersonIcon fontSize="small" /> Customer Information
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px',
                        padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)',
                        marginBottom: 24, fontSize: '0.9rem',
                    }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 2 }}>Username</div>
                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{sub?.client?.username || 'N/A'}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 2 }}>Full Name</div>
                            <div style={{ fontWeight: 600 }}>{sub?.client?.fullName || 'N/A'}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 2 }}>Service Type</div>
                            <div>
                                <span className={`badge ${sub?.client?.serviceType?.toLowerCase()}`}>
                                    {sub?.client?.serviceType === 'HOTSPOT' ? 'Hotspot' : 'PPPoE'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 2 }}>Phone</div>
                            <div>{sub?.client?.phone || 'N/A'}</div>
                        </div>
                        {sub?.client?.macAddress && (
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 2 }}>MAC Address</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{sub.client.macAddress}</div>
                            </div>
                        )}
                        {sub?.client?.device && (
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 2 }}>Device</div>
                                <div>{sub.client.device}</div>
                            </div>
                        )}
                    </div>

                    {/* Service Configuration */}
                    <div className="form-section-title">
                        <SettingsIcon fontSize="small" /> Service Configuration
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Package / Plan <span className="required">*</span>
                        </label>
                        <select
                            className="form-select"
                            value={packageId}
                            onChange={(e) => handlePackageChange(e.target.value)}
                        >
                            <option value="">Select Package</option>
                            {packages.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} — {p.price?.toLocaleString()} TZS / {p.duration} {p.durationUnit?.toLowerCase()}
                                    {' '}({p.uploadSpeed}{p.uploadUnit}/{p.downloadSpeed}{p.downloadUnit})
                                </option>
                            ))}
                        </select>
                        {selectedPkg && (
                            <div className="form-hint">
                                Speed: {selectedPkg.uploadSpeed}{selectedPkg.uploadUnit} ↑ / {selectedPkg.downloadSpeed}{selectedPkg.downloadUnit} ↓
                                &nbsp;•&nbsp; Price: {selectedPkg.price?.toLocaleString()} TZS
                                &nbsp;•&nbsp; Duration: {selectedPkg.duration} {selectedPkg.durationUnit?.toLowerCase()}
                            </div>
                        )}
                    </div>

                    <div className="form-row" style={{ gap: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Router</label>
                            <select
                                className="form-select"
                                value={routerId}
                                onChange={(e) => setRouterId(e.target.value)}
                            >
                                <option value="">No Router</option>
                                {routers.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Status</label>
                            <select
                                className="form-select"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="SUSPENDED">Suspended</option>
                                <option value="EXTENDED">Extended</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Payment Method</label>
                        <select
                            className="form-select"
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                        >
                            <option value="">Not Set</option>
                            <option value="Cash">Cash</option>
                            <option value="M-Pesa">M-Pesa</option>
                            <option value="Airtel Money">Airtel Money</option>
                            <option value="Voucher">Voucher</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="MANUAL">Manual</option>
                        </select>
                    </div>

                    {/* Timeline Information */}
                    <div className="form-section-title" style={{ marginTop: 24 }}>
                        <CalendarMonthIcon fontSize="small" /> Timeline
                    </div>

                    <div className="form-row" style={{ gap: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarMonthIcon fontSize="small" style={{ color: 'var(--info)' }} />
                                Activated On
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={activatedDate}
                                    onChange={(e) => setActivatedDate(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="time"
                                    className="form-input"
                                    value={activatedTime}
                                    onChange={(e) => setActivatedTime(e.target.value)}
                                    step="1"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarMonthIcon fontSize="small" style={{ color: 'var(--primary)' }} />
                                <strong>Expires On</strong>
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={expiresDate}
                                    onChange={(e) => setExpiresDate(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="time"
                                    className="form-input"
                                    value={expiresTime}
                                    onChange={(e) => setExpiresTime(e.target.value)}
                                    step="1"
                                    style={{ flex: 1 }}
                                />
                            </div>
                            <div className="form-hint" style={{ marginTop: 8 }}>
                                ⓘ The service will be automatically disabled after this date and time.
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: 8,
                        marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-light)',
                    }}>
                        <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={saving}>
                            <ArrowBackIcon fontSize="small" style={{ marginRight: 4 }} /> Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving || !packageId}
                            style={{ opacity: saving || !packageId ? 0.7 : 1 }}
                        >
                            {saving ? (
                                <><SyncIcon fontSize="small" className="spin" style={{ marginRight: 4 }} /> Saving...</>
                            ) : (
                                <><SaveIcon fontSize="small" style={{ marginRight: 4 }} /> Save Changes</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
