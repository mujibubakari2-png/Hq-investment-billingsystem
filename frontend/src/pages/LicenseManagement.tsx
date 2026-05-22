import { useState, useEffect } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningIcon from '@mui/icons-material/Warning';
import { licenseApi, type LicenseResponse } from '../api/client';
import CircularProgress from '@mui/material/CircularProgress';
import { formatDate } from '../utils/formatters';

export default function LicenseManagement() {
    const [license, setLicense] = useState<LicenseResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchLicense();
    }, []);

    const fetchLicense = async () => {
        try {
            const data = await licenseApi.getLicense();
            setLicense(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load license details');
        } finally {
            setLoading(false);
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
        return <div style={{ color: '#ef4444', padding: '20px' }}>{error}</div>;
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
        clientLimit, 
        paidThisMonth, 
        hasOutstanding 
    } = license || {};

    const copyKey = () => {
        if (licenseKey) {
            navigator.clipboard.writeText(licenseKey);
            alert('License key copied to clipboard!');
        }
    };
    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>License Management</h1>
                <p style={{ color: '#16a34a', fontSize: '0.85rem' }}>Manage your ISP license and invoices</p>
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
                        <div style={{ fontSize: '0.8rem', color: daysRemaining! > 0 ? (daysRemaining! > 7 ? '#16a34a' : '#ef4444') : 'var(--text-secondary)', marginBottom: 12 }}>
                            {!expiresAt
                                ? 'No expiry date — contact your provider'
                                : daysRemaining! > 0
                                    ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`
                                    : 'License expired'
                            }
                        </div>
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
                    <PeopleIcon style={{ fontSize: 24, color: customersCount! >= clientLimit! ? '#ef4444' : '#3b82f6', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{customersCount} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ {clientLimit}</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customers Bound</div>
                </div>

                {/* Paid This Month stat */}
                <div style={{
                    padding: '20px 30px', borderLeft: '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <AccountBalanceWalletIcon style={{ fontSize: 24, color: 'var(--info)', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>TSH {paidThisMonth?.toLocaleString()}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--info)' }}>SaaS Payments (MTD)</div>
                </div>
            </div>

            {/* All Invoices Paid */}
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                {hasOutstanding ? (
                    <>
                        <WarningIcon style={{ fontSize: 48, color: '#ef4444', marginBottom: 12 }} />
                        <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>Outstanding SaaS Billing</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>You have unpaid invoices pending. Please settle them rapidly to avoid suspension.</p>
                    </>
                ) : (
                    <>
                        <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                        <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>All Invoices Paid!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>You have no outstanding ISP invoices mapped.</p>
                    </>
                )}
            </div>
        </div>
    );
}
