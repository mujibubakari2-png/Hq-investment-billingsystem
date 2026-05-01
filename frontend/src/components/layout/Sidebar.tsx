import { useState, useEffect } from 'react';
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
import BusinessIcon from '@mui/icons-material/Business';

import CloseIcon from '@mui/icons-material/Close';
import authStore from '../../stores/authStore';
import { settingsApi } from '../../api/client';
import './Sidebar.css';

const navSections = [
    {
        title: 'MAIN',
        items: [
            { label: 'Dashboard', icon: 'dashboard', path: '/' },
        ],
    },
    {
        title: 'SUPER ADMIN',
        items: [
            { label: 'System Tenants', icon: 'business', path: '/system-tenants' },
        ],
    },
    {
        title: 'CLIENT MANAGEMENT',
        items: [
            { label: 'Clients', icon: 'people', path: '/clients' },
            { label: 'Active Subscribers', icon: 'person', path: '/active-subscribers' },
            { label: 'Expired Subscribers', icon: 'person-off', path: '/expired-subscribers' },
        ],
    },
    {
        title: 'PACKAGE MANAGEMENT',
        items: [
            { label: 'Packages', icon: 'inventory', path: '/packages' },
            { label: 'Voucher Codes', icon: 'voucher', path: '/voucher-codes' },
        ],
    },
    {
        title: 'FINANCE MANAGEMENT',
        items: [
            { label: 'Payments Records', icon: 'receipt', path: '/all-transactions' },
            { label: 'Mobile Transactions', icon: 'mobile', path: '/mobile-transactions' },
            { label: 'Expense Tracking', icon: 'wallet', path: '/expense-tracking' },
            { label: 'Invoices', icon: 'invoice', path: '/invoices' },
        ],
    },
    {
        title: 'NETWORK MANAGEMENT',
        items: [
            { label: 'Mikrotiks', icon: 'router', path: '/mikrotiks' },

            { label: 'Equipments', icon: 'devices', path: '/equipments' },
        ],
    },
    {
        title: 'COMMUNICATIONS',
        items: [
            { label: 'SMS Messages', icon: 'sms', path: '/sms-messages' },
            { label: 'Message Templates', icon: 'template', path: '/message-templates' },
        ],
    },
    {
        title: 'ADMINISTRATION',
        items: [
            { label: 'System Settings', icon: 'settings', path: '/system-settings' },
            { label: 'Payment Channels', icon: 'payment', path: '/payment-channels' },
            { label: 'System Users', icon: 'admin', path: '/system-users' },
            { label: 'License Management', icon: 'license', path: '/license-management' },
        ],
    },
    {
        title: 'REPORTS & HELP',
        items: [
            { label: 'Reports & Analytics', icon: 'reports', path: '/reports' },
            { label: 'Tutorial Videos', icon: 'tutorial', path: '/tutorial-videos' },
            { label: 'Technical Support', icon: 'support', path: '/technical-support' },
        ],
    },
];

const iconMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardIcon fontSize="small" />,
    people: <PeopleIcon fontSize="small" />,
    person: <PersonIcon fontSize="small" />,
    'person-off': <PersonOffIcon fontSize="small" />,
    inventory: <InventoryIcon fontSize="small" />,
    voucher: <ConfirmationNumberIcon fontSize="small" />,
    receipt: <ReceiptLongIcon fontSize="small" />,
    mobile: <PhoneAndroidIcon fontSize="small" />,
    wallet: <AccountBalanceWalletIcon fontSize="small" />,
    router: <RouterIcon fontSize="small" />,
    devices: <DevicesIcon fontSize="small" />,
    sms: <SmsIcon fontSize="small" />,
    template: <DescriptionIcon fontSize="small" />,
    settings: <SettingsIcon fontSize="small" />,
    payment: <PaymentIcon fontSize="small" />,
    admin: <AdminPanelSettingsIcon fontSize="small" />,
    license: <CardMembershipIcon fontSize="small" />,
    support: <SupportAgentIcon fontSize="small" />,
    reports: <BarChartIcon fontSize="small" />,
    tutorial: <PlayCircleIcon fontSize="small" />,
    invoice: <ReceiptIcon fontSize="small" />,
    vpn: <VpnKeyIcon fontSize="small" />,
    business: <BusinessIcon fontSize="small" />,

};

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const location = useLocation();
    const [collapsed] = useState(false);
    const { user } = authStore.useAuth();
    const [brand, setBrand] = useState({ main: 'HQ', sub: 'INVESTMENT' });

    useEffect(() => {
        const fetchBrand = () => {
            settingsApi.get().then((res: Record<string, string>) => {
                const data = typeof res === 'object' ? res : {};
                const companyName = data?.companyName || data?.['company_name'];
                if (companyName && typeof companyName === 'string') {
                    const parts = companyName.trim().split(' ');
                    if (parts.length > 1) {
                        setBrand({ main: parts[0], sub: parts.slice(1).join(' ') });
                    } else {
                        setBrand({ main: parts[0], sub: 'SYSTEM' }); // Fallback sub label if only one word
                    }
                }
            }).catch(console.error);
        };

        fetchBrand();
        if (typeof window !== 'undefined') {
            window.addEventListener('settingsUpdated', fetchBrand);
            return () => window.removeEventListener('settingsUpdated', fetchBrand);
        }
    }, []);

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
            <aside className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <h1 className="brand-name">{brand.main}</h1>
                        <p className="brand-sub">{brand.sub}</p>
                    </div>
                    <button className="sidebar-close-mobile" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navSections.map((section) => {
                        if (section.title === 'SUPER ADMIN' && user?.role !== 'SUPER_ADMIN') {
                            return null;
                        }

                        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

                        const filteredItems = section.items.filter(item => {
                            if (item.label === 'System Users') {
                                return isAdmin;
                            }
                            if (item.label === 'Invoices') {
                                return user?.role === 'SUPER_ADMIN';
                            }
                            return true;
                        });

                        if (filteredItems.length === 0) return null;

                        return (
                            <div key={section.title} className="nav-section">
                                <div className="nav-section-title">{section.title}</div>
                                {filteredItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                        onClick={onClose}
                                    >
                                        <span className="nav-icon">{iconMap[item.icon]}</span>
                                        <span className="nav-label">{item.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
