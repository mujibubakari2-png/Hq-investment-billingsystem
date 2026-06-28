import { useState, useEffect, useCallback } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningIcon from '@mui/icons-material/Warning';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RefreshIcon from '@mui/icons-material/Refresh';
import PaymentIcon from '@mui/icons-material/Payment';
import { licenseApi, saasPlansApi, type LicenseResponse, type SaasPlan } from '../api';
import CircularProgress from '@mui/material/CircularProgress';
import { formatDate } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const AUTO_REFRESH_INTERVAL = 30_000; // 30 seconds

export default function LicenseManagement() {
    const navigate = useNavigate();
    const [license, setLicense] = useState<LicenseResponse | null>(null);
    const [allPlans, setAllPlans] = useState<SaasPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [showChangePlan, setShowChangePlan] = useState(false);
    const [changingPlan, setChangingPlan] = useState(false);
    const [changePlanMsg, setChangePlanMsg] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [data, plans] = await Promise.all([
                licenseApi.getLicense(),
                saasPlansApi.list(),
            ]);
            setLicense(data);
            setAllPlans(plans);
            setLastRefresh(new Date());
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to load license details');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 30 seconds for real-time data
    useEffect(() => {
        const interval = setInterval(fetchData, AUTO_REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleChangePlan = async (planId: string) => {
        setChangingPlan(true);
        setChangePlanMsg('');
        try {
            const res = await licenseApi.changePlan(planId);
            setChangePlanMsg(res.message || 'Plan changed successfully!');
            const updated = await licenseApi.getLicense();
            setLicense(updated);
            setTimeout(() => { setShowChangePlan(false); setChangePlanMsg(''); }, 2000);
        } catch (err: any) {
            setChangePlanMsg(err.message || 'Failed to change plan.');
        } finally {
            setChangingPlan(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
                <CircularProgress style={{ color: '#16a34a' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px' }}>
                <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>
                <button className="btn btn-primary" onClick={fetchData}>
                    <RefreshIcon style={{ fontSize: 16, marginRight: 4 }} /> Retry
                </button>
            </div>
        );
    }

    if (license?.isSuperAdmin) {
        return (
            <div>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>License Management</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Global System Administration</p>
                </div>
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>Unlimited Access</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Your Super Admin profile bypasses tenant license restrictions.</p>
                </div>
            </div>
        );
    }

    const {
        licenseKey,
        daysRemaining,
        expiresAt,
        customersCount,
        pppoeLimit,
        hotspotLimit,
        hasOutstanding,
        hasPending,
        plan,
        outstandingInvoices,
        pendingInvoices,
        totalOutstanding: totalOutstandingFromApi,
    } = license || {};

    // Total outstanding amount (all PENDING invoices) — prefer API value, fallback to sum
    const totalOutstanding = totalOutstandingFromApi ?? (pendingInvoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const hasAnyPending = (hasPending || hasOutstanding) && totalOutstanding > 0;

    const copyKey = () => {
        if (licenseKey) {
            navigator.clipboard.writeText(licenseKey);
            alert('License key copied to clipboard!');
        }
    };

    return (
        <div>
            {/* Change Plan Modal */}
            {showChangePlan && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Change SaaS Plan</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Current plan: <strong>{plan?.name || '—'}</strong>. Select a new plan below:
                        </p>
                        {allPlans.map(p => (
                            <div
                                key={p.id}
                                onClick={() => !changingPlan && handleChangePlan(p.id)}
                                style={{
                                    border: `2px solid ${plan?.id === p.id ? '#16a34a' : 'var(--border-light)'}`,
                                    borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.75rem',
                                    cursor: changingPlan ? 'wait' : 'pointer',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: plan?.id === p.id ? '#f0fdf4' : '#fff',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {p.name}
                                        {plan?.id === p.id && <span style={{ fontSize: '0.7rem', background: '#16a34a', color: '#fff', padding: '1px 8px', borderRadius: 10 }}>CURRENT</span>}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {p.pppoeLimit.toLocaleString()} PPPoE, {p.hotspotLimit ? p.hotspotLimit.toLocaleString() : '∞'} Hotspot, {p.maxRouters} {p.maxRouters === 1 ? 'Router' : 'Routers'}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, textAlign: 'right' }}>
                                    TSH {p.price.toLocaleString()}/mo
                                </div>
                            </div>
                        ))}
                        {changePlanMsg && (
                            <div style={{
                                padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.5rem',
                                background: changePlanMsg.toLowerCase().includes('success') || changePlanMsg.toLowerCase().includes('changed') ? '#dcfce7' : '#fee2e2',
                                color: changePlanMsg.toLowerCase().includes('success') || changePlanMsg.toLowerCase().includes('changed') ? '#166534' : '#b91c1c',
                            }}>{changePlanMsg}</div>
                        )}
                        <button
                            onClick={() => { setShowChangePlan(false); setChangePlanMsg(''); }}
                            style={{ marginTop: '1rem', width: '100%', padding: '10px', background: '#f1f5f9', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>License Management</h1>
                    <p style={{ color: '#16a34a', fontSize: '0.85rem' }}>Manage your ISP license and invoices</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Updated {lastRefresh.toLocaleTimeString()}
                    </span>
                    <button
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', padding: '6px 12px' }}
                        onClick={fetchData}
                    >
                        <RefreshIcon style={{ fontSize: 15 }} /> Refresh
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', padding: '6px 12px', background: '#1a1a2e' }}
                        onClick={() => setShowChangePlan(true)}
                    >
                        <SwapHorizIcon style={{ fontSize: 15 }} /> Change Plan
                    </button>
                </div>
            </div>

            {/* License Info Row */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginBottom: 24, background: '#fff',
            }}>
                {/* License Active Card */}
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {(daysRemaining! > 0 || !expiresAt) && license?.status !== 'SUSPENDED' ? (
                        <CheckCircleIcon style={{ color: '#16a34a', fontSize: 28, marginTop: 2 }} />
                    ) : (
                        <WarningIcon style={{ color: '#ef4444', fontSize: 28, marginTop: 2 }} />
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, color: license?.status === 'SUSPENDED' ? '#ef4444' : '#16a34a', fontSize: '1rem' }}>
                                {license?.status === 'SUSPENDED' ? 'Account Suspended' : 'License Active'}
                            </div>
                            {license?.status === 'TRIALLING' && (
                                <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>TRIAL</span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: daysRemaining! > 0 ? (daysRemaining! > 7 ? '#16a34a' : '#ef4444') : 'var(--text-secondary)', marginBottom: 8 }}>
                            {!expiresAt
                                ? 'No expiry date — contact your provider'
                                : daysRemaining! > 0
                                    ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`
                                    : 'License expired'
                            }
                        </div>
                        {/* Plan info */}
                        {plan && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>Plan: <strong>{plan.name}</strong></span>
                                <span>•</span>
                                <span>TSH {plan.price.toLocaleString()}/month</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 24, fontSize: '0.8rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Key </span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{licenseKey?.substring(0, 12)}...</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Expires </span>
                                <span style={{ fontWeight: 600 }}>{expiresAt ? formatDate(expiresAt) : '—'}</span>
                            </div>
                        </div>
                    </div>
                    <button style={{
                        background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '6px 8px', cursor: 'pointer',
                        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                    }} onClick={copyKey}>
                        <ContentCopyIcon style={{ fontSize: 14 }} />
                    </button>
                </div>

                {/* Customers stat */}
                <div style={{
                    padding: '20px 30px', borderLeft: '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <PeopleIcon style={{ fontSize: 24, color: customersCount! >= (pppoeLimit! + (hotspotLimit || 0)) ? '#ef4444' : '#3b82f6', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{customersCount} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ {pppoeLimit! + (hotspotLimit ? hotspotLimit : 0)}{hotspotLimit === null ? '+' : ''}</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customers Bound</div>
                </div>

                {/* Paid This Month stat */}
                <div style={{
                    padding: '20px 30px', borderLeft: '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                </div>
            </div>

            {/* Quick Actions */}
            {(daysRemaining! <= 5 || hasAnyPending) && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => navigate('/renew')}
                    >
                        <PaymentIcon style={{ fontSize: 16 }} /> Pay Invoice / Renew
                    </button>
                </div>
            )}

            {/* Invoice Status */}
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                {hasAnyPending ? (
                    <>
                        <WarningIcon style={{ fontSize: 48, color: '#ef4444', marginBottom: 12 }} />
                        <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>Outstanding Invoices</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 8 }}>
                            You have {pendingInvoices?.length || outstandingInvoices?.length || 1} unpaid invoice{(pendingInvoices?.length || 1) > 1 ? 's' : ''} pending. Please settle to avoid suspension.
                        </p>
                        {/* Total outstanding amount */}
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 20px', marginBottom: 16, display: 'inline-block', minWidth: 200 }}>
                            <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600, marginBottom: 4 }}>TOTAL OUTSTANDING INVOICE</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ef4444' }}>
                                TSH {totalOutstanding.toLocaleString()}
                            </div>
                        </div>
                        {/* List each pending invoice */}
                        {pendingInvoices && pendingInvoices.length > 0 && (
                            <div style={{ margin: '0 auto 16px', maxWidth: 480, textAlign: 'left' }}>
                                {pendingInvoices.map(inv => (
                                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{inv.invoiceNumber}</span>
                                        <span style={{ fontWeight: 700, color: '#ef4444' }}>TSH {inv.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/renew')}>
                            <PaymentIcon style={{ fontSize: 16 }} /> Pay Now — TSH {totalOutstanding.toLocaleString()}
                        </button>
                    </>
                ) : (
                    <>
                        <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                        <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>All Invoices Paid!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>You have no outstanding invoices.</p>
                        <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/renew')}>
                            <PaymentIcon style={{ fontSize: 16 }} /> Renew / Pay Invoice
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
