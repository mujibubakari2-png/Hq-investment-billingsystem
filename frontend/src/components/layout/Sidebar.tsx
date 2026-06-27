import { NavLink, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import InventoryIcon from '@mui/icons-material/Inventory';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RouterIcon from '@mui/icons-material/Router';
import DevicesIcon from '@mui/icons-material/Devices';
import SmsIcon from '@mui/icons-material/Sms';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import PaymentIcon from '@mui/icons-material/Payment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import BarChartIcon from '@mui/icons-material/BarChart';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CloseIcon from '@mui/icons-material/Close';

import authStore from '../../stores/authStore';
import './Sidebar.css';

// ─── Role types ───────────────────────────────────────────────────────────────
type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT' | 'VIEWER';

interface NavItem {
    label: string;
    icon: string;
    path: string;
    /** If set, only these roles can see this item */
    roles?: AppRole[];
    /**
     * If true, this item is ONLY shown to the Platform Super Admin
     * (isPlatformAdmin === true, no tenantId). It is completely hidden
     * from ALL tenant users — including tenant SUPER_ADMINs.
     */
    platformOnly?: boolean;
}

interface NavSection {
    title: string;
    /** If set, the entire section is hidden for roles not in this list */
    roles?: AppRole[];
    /**
     * If true, this entire section is ONLY shown to the Platform Super Admin.
     * Hidden from ALL tenant users including tenant SUPER_ADMINs.
     */
    platformOnly?: boolean;
    items: NavItem[];
}

// ─── Nav definition with RBAC gates ──────────────────────────────────────────
// Spec § 2: role permission matrix
const navSections: NavSection[] = [
    {
        title: 'MAIN',
        items: [
            { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
        ],
    },
    {
        title: 'CLIENT MANAGEMENT',
        items: [
            { label: 'Clients',             icon: 'people',     path: '/clients' },
            { label: 'Active Subscribers',  icon: 'person',     path: '/active-subscribers' },
            { label: 'Expired Subscribers', icon: 'person-off', path: '/expired-subscribers' },
        ],
    },
    {
        title: 'PACKAGE MANAGEMENT',
        items: [
            { label: 'Packages',    icon: 'inventory', path: '/packages' },
            { label: 'Voucher Codes', icon: 'voucher', path: '/voucher-codes' },
        ],
    },
    {
        title: 'FINANCE MANAGEMENT',
        items: [
            { label: 'Payments Records',    icon: 'receipt', path: '/all-transactions' },
            { label: 'Mobile Transactions', icon: 'mobile',  path: '/mobile-transactions' },
            { label: 'Expense Tracking',    icon: 'wallet',  path: '/expense-tracking' },
            // Invoices: Platform Super Admin ONLY — completely hidden from all tenant users
            { label: 'Invoices', icon: 'invoice', path: '/invoices', platformOnly: true },
        ],
    },
    {
        title: 'NETWORK MANAGEMENT',
        items: [
            { label: 'Mikrotiks',   icon: 'router',   path: '/mikrotiks' },
            { label: 'Equipments',  icon: 'devices',  path: '/equipments' },
            // VPN Management: Platform Super Admin ONLY — completely hidden from all tenant users
            { label: 'VPN Management', icon: 'vpn', path: '/vpn-management', platformOnly: true },
        ],
    },
    {
        title: 'COMMUNICATIONS',
        items: [
            { label: 'SMS Messages',      icon: 'sms',      path: '/sms-messages' },
            { label: 'Message Templates', icon: 'template', path: '/message-templates' },
        ],
    },
    {
        // Administration: tenant SUPER_ADMIN sees most items; platformOnly items filtered separately
        title: 'ADMINISTRATION',
        roles: ['SUPER_ADMIN'],
        items: [
            { label: 'System Settings',    icon: 'settings', path: '/system-settings' },
            { label: 'Payment Channels',   icon: 'payment',  path: '/payment-channels' },
            { label: 'System Users',       icon: 'admin',    path: '/system-users' },
            // License Management: Platform Super Admin ONLY — completely hidden from tenant SUPER_ADMINs
            { label: 'License Management', icon: 'license',  path: '/license-management', platformOnly: true },
            { label: 'Hotspot Customizer', icon: 'router',   path: '/hotspot-customizer' },
            { label: 'Audit Logs',         icon: 'audit',    path: '/audit-logs' },
        ],
    },
    {
        title: 'REPORTS & HELP',
        items: [
            { label: 'Reports & Analytics', icon: 'reports',  path: '/reports' },
            { label: 'Tutorial Videos',     icon: 'tutorial', path: '/tutorial-videos' },
            { label: 'Technical Support',   icon: 'support',  path: '/technical-support' },
        ],
    },
];

const iconMap: Record<string, React.ReactNode> = {
    dashboard:    <DashboardIcon fontSize="small" />,
    people:       <PeopleIcon fontSize="small" />,
    person:       <PersonIcon fontSize="small" />,
    'person-off': <PersonOffIcon fontSize="small" />,
    inventory:    <InventoryIcon fontSize="small" />,
    voucher:      <ConfirmationNumberIcon fontSize="small" />,
    receipt:      <ReceiptLongIcon fontSize="small" />,
    mobile:       <PhoneAndroidIcon fontSize="small" />,
    wallet:       <AccountBalanceWalletIcon fontSize="small" />,
    router:       <RouterIcon fontSize="small" />,
    devices:      <DevicesIcon fontSize="small" />,
    sms:          <SmsIcon fontSize="small" />,
    template:     <DescriptionIcon fontSize="small" />,
    settings:     <SettingsIcon fontSize="small" />,
    payment:      <PaymentIcon fontSize="small" />,
    admin:        <AdminPanelSettingsIcon fontSize="small" />,
    license:      <CardMembershipIcon fontSize="small" />,
    support:      <SupportAgentIcon fontSize="small" />,
    reports:      <BarChartIcon fontSize="small" />,
    tutorial:     <PlayCircleIcon fontSize="small" />,
    invoice:      <ReceiptIcon fontSize="small" />,
    vpn:          <VpnKeyIcon fontSize="small" />,
    audit:        <AdminPanelSettingsIcon fontSize="small" />,
};

interface SidebarProps {
    isOpen: boolean;
    collapsed?: boolean;
    onClose: () => void;
}

/**
 * Returns true if the user is permitted to see a nav item/section.
 *
 * Two independent gates:
 *  1. platformOnly — must have isPlatformAdmin===true (no tenantId).
 *     This ALWAYS overrides the roles gate. A tenant SUPER_ADMIN with
 *     platformOnly===true will NEVER see the item.
 *  2. roles — a simple role-membership check (skipped when gate is empty).
 */
function allowed(
    userRole: string,
    isPlatformAdmin: boolean,
    roles?: AppRole[],
    platformOnly?: boolean,
): boolean {
    // Gate 1 — platform-admin-only items are invisible to ALL tenant users
    if (platformOnly) return isPlatformAdmin;
    // Gate 2 — role-based visibility (no gate = any role allowed)
    if (!roles || roles.length === 0) return true;
    return roles.includes(userRole as AppRole);
}

/** Derive sidebar brand from the auth user's tenant branding (no extra API call) */
function parseBrand(companyName?: string | null): { main: string; sub: string } {
    if (!companyName) return { main: 'HQ', sub: 'INVESTMENT' };
    const parts = companyName.trim().split(' ');
    return {
        main: parts[0],
        sub: parts.length > 1 ? parts.slice(1).join(' ') : 'SYSTEM',
    };
}

export default function Sidebar({ isOpen, collapsed = false, onClose }: SidebarProps) {
    const location = useLocation();
    const { user } = authStore.useAuth();

    const userRole = user?.role ?? 'VIEWER';
    // Platform Super Admin: isPlatformAdmin flag set by backend at login,
    // OR no tenantId with SUPER_ADMIN role (fallback for legacy tokens).
    const isPlatformAdmin = user?.isPlatformAdmin === true || (userRole === 'SUPER_ADMIN' && !user?.tenantId);
    const { main, sub } = parseBrand(user?.companyName);

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <aside className={`sidebar${isOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        {user?.companyLogo ? (
                            <img src={user.companyLogo} alt="Logo" style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }} />
                        ) : (
                            <>
                                <h1 className="brand-name">{main}</h1>
                                <p className="brand-sub">{sub}</p>
                            </>
                        )}
                    </div>
                    <button className="sidebar-close-mobile" onClick={onClose} aria-label="Close menu">
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navSections.map((section) => {
                        // Section-level gates (platformOnly takes precedence over roles)
                        if (!allowed(userRole, isPlatformAdmin, section.roles, section.platformOnly)) return null;

                        // Item-level gates (platformOnly takes precedence over roles)
                        const items = section.items.filter(item =>
                            allowed(userRole, isPlatformAdmin, item.roles, item.platformOnly)
                        );
                        if (items.length === 0) return null;

                        return (
                            <div key={section.title} className="nav-section">
                                <div className="nav-section-title">{section.title}</div>
                                {items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `nav-item${isActive || location.pathname === item.path ? ' active' : ''}`
                                        }
                                        onClick={onClose}
                                        title={item.label}
                                    >
                                        <span className="nav-icon">{iconMap[item.icon]}</span>
                                        <span className="nav-label">{item.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                {/* Role badge at sidebar footer */}
                {user && (
                    <div style={{
                        padding: '10px 16px',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #9ca3af)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        overflow: 'hidden',
                    }}>
                        <span style={{
                            flexShrink: 0,
                            background: 'var(--primary-faint, rgba(99,102,241,0.12))',
                            color: 'var(--primary, #6366f1)',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: '0.68rem',
                            letterSpacing: '0.03em',
                            whiteSpace: 'nowrap',
                        }}>
                            {userRole.replace('_', ' ')}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.fullName || user.username}
                        </span>
                    </div>
                )}
            </aside>
        </>
    );
}
