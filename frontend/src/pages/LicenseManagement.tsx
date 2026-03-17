import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function LicenseManagement() {
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
                    <CheckCircleIcon style={{ color: '#16a34a', fontSize: 28, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '1rem' }}>License Active</div>
                        <div style={{ fontSize: '0.8rem', color: '#16a34a', marginBottom: 12 }}>9 days remaining</div>
                        <div style={{ display: 'flex', gap: 24, fontSize: '0.8rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Key </span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>LTC-26608396...</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Expires </span>
                                <span style={{ fontWeight: 600 }}>Mar 06, 2026</span>
                            </div>
                        </div>
                    </div>
                    <button style={{
                        background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '6px 8px', cursor: 'pointer',
                        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                    }} onClick={() => {
                        navigator.clipboard.writeText('LTC-26608396');
                        alert('License key copied to clipboard!');
                    }}>
                        <ContentCopyIcon style={{ fontSize: 14 }} />
                    </button>
                </div>

                {/* Customers stat */}
                <div style={{
                    padding: '20px 30px', borderLeft: '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <PeopleIcon style={{ fontSize: 24, color: '#ef4444', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>15</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customers</div>
                </div>

                {/* Paid This Month stat */}
                <div style={{
                    padding: '20px 30px', borderLeft: '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <AccountBalanceWalletIcon style={{ fontSize: 24, color: 'var(--info)', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>TSH 0</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--info)' }}>Paid This Month</div>
                </div>
            </div>

            {/* All Invoices Paid */}
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>All Invoices Paid!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>You have no outstanding invoices</p>
            </div>
        </div>
    );
}
