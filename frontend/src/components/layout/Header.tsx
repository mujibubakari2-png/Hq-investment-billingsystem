import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { licenseApi, type LicenseResponse } from '../../api';
import authStore from '../../stores/authStore';
import './Header.css';

// Map paths to friendly page titles
const pageTitles: Record<string, string> = {
    '/dashboard':           'Dashboard',
    '/clients':             'Clients',
    '/active-subscribers':  'Active Subscribers',
    '/expired-subscribers': 'Expired Subscribers',
    '/packages':            'Packages',
    '/voucher-codes':       'Voucher Codes',
    '/all-transactions':    'Payment Records',
    '/mobile-transactions': 'Mobile Transactions',
    '/expense-tracking':    'Expense Tracking',
    '/invoices':            'Invoices',
    '/mikrotiks':           'Mikrotiks',
    '/equipments':          'Equipments',
    '/sms-messages':        'SMS Messages',
    '/message-templates':   'Message Templates',
    '/system-settings':     'System Settings',
    '/payment-channels':    'Payment Channels',
    '/system-users':        'System Users',
    '/license-management':  'License Management',
    '/reports':             'Reports & Analytics',
    '/tutorial-videos':     'Tutorial Videos',
    '/technical-support':   'Technical Support',
    '/profile':             'My Profile',
    '/system-tenants':      'System Tenants',
    '/hotspot-customizer':  'Hotspot Customizer',
    '/vpn-management':      'VPN Management',
};

// Human-readable role label shown in the header dropdown
function roleLabel(role: string): string {
    switch (role) {
        case 'SUPER_ADMIN': return 'Super Admin';
        case 'ADMIN':  return 'Admin';
        case 'AGENT':  return 'Agent';
        case 'VIEWER': return 'Viewer';
        default: return role;
    }
}

interface HeaderProps {
    onToggleSidebar: () => void;
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

export default function Header({ onToggleSidebar, darkMode, onToggleDarkMode }: HeaderProps) {
    const { user } = authStore.useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showMenu, setShowMenu] = useState(false);
    const [license, setLicense] = useState<LicenseResponse | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const isPlatformAdmin = user?.isPlatformAdmin === true || (user?.role === 'SUPER_ADMIN' && !user?.tenantId);

    // Fetch tenant license expiry for every tenant user, including tenant SUPER_ADMIN.
    useEffect(() => {
        if (user && !isPlatformAdmin) {
            licenseApi.getLicense().then(setLicense).catch(console.error);
        }
    }, [user, isPlatformAdmin]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayName = user?.fullName || user?.username || 'User';
    const initials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U';

    const pageTitle = pageTitles[location.pathname] || 'Dashboard';

    // BRAND-001: Company name comes from the auth user object (set at login/register),
    // so we never need an extra API call just to render the header.
    const companyName = user?.companyName || 'HQ INVESTMENT';

    const handleLogout = () => {
        setShowMenu(false);
        authStore.logout();
        navigate('/login', { replace: true });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'sticky', top: 0, zIndex: 200, backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', background: 'var(--bg-header)' }}>
            {/* License expiry warning banner — only for non-SUPER_ADMIN nearing expiry */}
            {license &&
                typeof license.daysRemaining === 'number' &&
                license.daysRemaining > 0 &&
                license.daysRemaining <= 7 && (
                    <div
                        style={{
                            background: license.daysRemaining <= 2 ? '#fee2e2' : '#fef3c7',
                            color: license.daysRemaining <= 2 ? '#991b1b' : '#92400e',
                            padding: '9px 20px',
                            textAlign: 'center',
                            fontWeight: 600,
                            borderBottom: `1px solid ${license.daysRemaining <= 2 ? '#fca5a5' : '#fde68a'}`,
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span>{license.daysRemaining <= 2 ? '🚨' : '⚠️'}</span>
                        <span>
                            Your account will be restricted in{' '}
                            <strong>{license.daysRemaining}</strong>{' '}
                            {license.daysRemaining === 1 ? 'day' : 'days'}.
                        </span>
                        <span
                            style={{ textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={() => navigate('/renew')}
                        >
                            Renew now
                        </span>
                    </div>
                )}

            {/* Outstanding Invoice Warning */}
            {license?.hasOutstanding && license.outstandingInvoices && license.outstandingInvoices.length > 0 && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '9px 20px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #fca5a5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>🚨</span>
                    <span>
                        You have an overdue payment for invoice <strong>{license.outstandingInvoices[0].invoiceNumber}</strong>. Please pay to avoid suspension.
                    </span>
                    <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/renew', { state: { amount: license.outstandingInvoices![0].amount } })}>
                        Pay now
                    </span>
                </div>
            )}

            <header className="header" style={{ position: 'relative', top: 'unset', zIndex: 'unset', backdropFilter: 'none', WebkitBackdropFilter: 'none', background: 'transparent' }}>
                <div className="header-left">
                    <button
                        className="hamburger-btn"
                        onClick={onToggleSidebar}
                        aria-label="Toggle sidebar"
                    >
                        <MenuIcon />
                    </button>
                    <span className="header-title">{pageTitle}</span>
                </div>

                <div className="header-right">
                    {/* Company name badge — BRAND-001 */}
                    <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'none', // hidden on mobile (too narrow)
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 200,
                        alignItems: 'center',
                        gap: 6
                    }}
                        className="header-company-name"
                    >
                        {user?.companyLogo && (
                            <img src={user.companyLogo} alt="Logo" style={{ height: 20, width: 'auto', borderRadius: 4 }} />
                        )}
                        <span>{companyName}</span>
                    </span>

                    <button
                        className="header-icon-btn"
                        onClick={onToggleDarkMode}
                        aria-label="Toggle dark mode"
                    >
                        {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                    </button>

                    <div className="header-user" ref={menuRef}>
                        <div
                            className="header-avatar"
                            onClick={() => setShowMenu(v => !v)}
                            aria-label="User menu"
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && setShowMenu(v => !v)}
                        >
                            {initials}
                        </div>

                        {showMenu && (
                            <div className="header-dropdown">
                                <div className="header-dropdown-info">
                                    <div className="header-dropdown-name">{displayName}</div>
                                    <div className="header-dropdown-role">{roleLabel(user?.role ?? '')}</div>
                                    {/* Show company name in dropdown for context */}
                                    {companyName && companyName !== 'HQ INVESTMENT' && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            {companyName}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="header-dropdown-btn"
                                    onClick={() => { setShowMenu(false); navigate('/profile'); }}
                                >
                                    <PersonIcon fontSize="small" />
                                    My Profile
                                </button>
                                <button
                                    className="header-dropdown-btn danger"
                                    onClick={handleLogout}
                                >
                                    <LogoutIcon fontSize="small" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Show company name on tablets and up */}
            <style>{`
                @media (min-width: 600px) {
                    .header-company-name { display: flex !important; }
                }
            `}</style>
        </div>
    );
}
