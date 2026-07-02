import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import { licenseApi, type LicenseResponse } from '../api';
import authStore from '../stores/authStore';
import { formatDate } from '../utils/formatters';

export default function Restricted() {
    const navigate = useNavigate();
    const { logout } = authStore;
    const [license, setLicense] = useState<LicenseResponse | null>(null);

    useEffect(() => {
        licenseApi.getLicense().then(setLicense).catch(console.error);
    }, []);

    // Use pendingInvoices (ALL pending) OR outstandingInvoices (past-due) as fallback
    const pendingList = license?.pendingInvoices || license?.outstandingInvoices || [];
    const outstandingTotal = license?.totalOutstanding ?? pendingList.reduce((sum, inv) => sum + inv.amount, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-lighter)', alignItems: 'center', paddingTop: '4rem', fontFamily: 'var(--font-family)' }}>
            <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2rem', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ margin: '0 auto', width: 64, height: 64, borderRadius: '50%', background: '#ffebee', color: '#d32f2f', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <LockPersonIcon fontSize="large" />
                </div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Account Restricted</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.85rem' }}>{license?.companyName || 'HQ INVESTMENT'}</p>
                
                <div style={{ background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                    <div style={{ color: '#d32f2f', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>Why am I seeing this?</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#c62828', fontSize: '0.85rem' }}>
                        <li style={{ marginBottom: '0.25rem' }}>
                            {license?.expiresAt
                                ? <>Your license expired on {formatDate(license.expiresAt)}. Please renew to continue.</>
                                : <>Your account has been suspended. Please contact support or renew your license to restore access.</>
                            }
                        </li>
                        {license?.hasOutstanding && (
                            <li>You have {pendingList.length} overdue invoice{pendingList.length !== 1 ? 's' : ''} totaling {outstandingTotal.toLocaleString()}/=. Please make payment to restore access.</li>
                        )}
                    </ul>
                </div>

                <div style={{ textAlign: 'left', marginBottom: '1.5rem', background: 'var(--bg-body)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>License Status</span>
                        <span style={{ fontSize: '0.75rem', background: '#ffebee', color: '#d32f2f', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>{license?.status || 'EXPIRED'}</span>
                    </div>
                    {license?.expiresAt && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Expiry Date</span>
                            <span style={{ fontSize: '0.9rem', color: '#d32f2f', fontWeight: 700 }}>{formatDate(license.expiresAt)}</span>
                        </div>
                    )}
                </div>

                {license?.hasOutstanding && (
                    <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Overdue Invoices</span>
                            <span style={{ fontSize: '0.75rem', background: '#ffebee', color: '#d32f2f', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>{pendingList.length} OVERDUE</span>
                        </div>
                        {pendingList.map(inv => (
                            <div key={inv.id} style={{ background: 'var(--bg-body)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{inv.invoiceNumber || inv.id.substring(0, 8).toUpperCase()}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due: {formatDate(inv.dueDate)}</div>
                                </div>
                                <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>{inv.amount.toLocaleString()}/=</div>
                            </div>
                        ))}

                        <div style={{ background: '#d32f2f', padding: '1.25rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', marginTop: '1rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Total Outstanding</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{outstandingTotal.toLocaleString()}/=</span>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={() => navigate('/renew', { state: { amount: outstandingTotal } })} style={{ width: '100%', background: '#1a1a2e', color: 'white', padding: '0.75rem', fontWeight: 600 }}>
                        Pay Outstanding Invoices
                    </button>
                    <button className="btn btn-secondary" onClick={() => navigate('/license-management')} style={{ width: '100%', background: '#ffffff', color: '#1a1a2e', border: '1px solid var(--border-light)', padding: '0.75rem', fontWeight: 600 }}>
                        Renew License
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <p>Need assistance? Contact our support team.</p>
                <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', marginTop: '1rem' }}>
                    Sign out and use a different account
                </button>
            </div>
            
            <div style={{ marginTop: 'auto', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                &copy; {new Date().getFullYear()} {license?.companyName || 'Our Company'}
            </div>
        </div>
    );
}
