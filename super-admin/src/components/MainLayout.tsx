import { useState, useEffect, type ReactNode } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { authApi } from '../api';
import { commerceNavigationItems } from '../config/ecommerceModules';
import {
  LayoutDashboard, Users, FileText, CreditCard, Shield,
  Settings, LogOut, Menu, X, Zap, Receipt, BarChart3,
  UserCog, Bell, Webhook, Server, Image, Star, MessageSquare,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  section?: string;
  badge?: { value: number; type: 'danger' | 'warning' | 'info' };
}

const NAV_ITEMS: NavItem[] = [
  // Platform
  { section: 'Platform', to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Overview' },
  { to: '/tenants', icon: <Users size={16} />, label: 'Tenants' },
  { to: '/licenses', icon: <FileText size={16} />, label: 'Licenses' },
  { to: '/invoices', icon: <Receipt size={16} />, label: 'Invoices' },
  { to: '/plans', icon: <CreditCard size={16} />, label: 'SaaS Plans' },
  { to: '/reports', icon: <BarChart3 size={16} />, label: 'Reports' },
  ...commerceNavigationItems,
  // CMS
  { section: 'CMS & Storefront', to: '/cms/banners', icon: <Image size={16} />, label: 'Banners' },
  { to: '/cms/testimonials', icon: <Star size={16} />, label: 'Testimonials' },
  { to: '/cms/faqs', icon: <FileText size={16} />, label: 'FAQs' },
  { to: '/cms/subscribers', icon: <Users size={16} />, label: 'Subscribers' },
  { to: '/cms/blogs', icon: <FileText size={16} />, label: 'Blog Posts' },
  { to: '/cms/pages', icon: <FileText size={16} />, label: 'Custom Pages' },
  { to: '/cms/contacts', icon: <MessageSquare size={16} />, label: 'Inquiries' },
  { to: '/cms/storefront-settings', icon: <Settings size={16} />, label: 'Store Settings' },
  // Communications
  { section: 'Communications', to: '/notifications', icon: <Bell size={16} />, label: 'Notifications' },
  // System
  { section: 'System', to: '/admins', icon: <UserCog size={16} />, label: 'Admins' },
  { to: '/webhooks', icon: <Webhook size={16} />, label: 'Webhooks' },
  { to: '/audit-logs', icon: <Shield size={16} />, label: 'Audit Logs' },
  { to: '/system', icon: <Server size={16} />, label: 'System Health' },
  { to: '/settings', icon: <Settings size={16} />, label: 'Settings' },
];

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function getPageTitle(pathname: string): { name: string; breadcrumb: string } {
  const map: Record<string, { name: string; breadcrumb: string }> = {
    '/dashboard': { name: 'Platform Overview', breadcrumb: 'Dashboard / Overview' },
    '/tenants': { name: 'Tenant Management', breadcrumb: 'Dashboard / Tenants' },
    '/licenses': { name: 'License Management', breadcrumb: 'Dashboard / Licenses' },
    '/invoices': { name: 'SaaS Invoices', breadcrumb: 'Dashboard / Invoices' },
    '/plans': { name: 'SaaS Plans', breadcrumb: 'Dashboard / Plans' },
    '/reports': { name: 'Platform Reports', breadcrumb: 'Dashboard / Reports' },
    '/ecommerce': { name: 'E-Commerce', breadcrumb: 'E-Commerce / Command Center' },
    '/notifications': { name: 'Notifications', breadcrumb: 'Communications / Notifications' },
    '/admins': { name: 'Platform Admins', breadcrumb: 'System / Admins' },
    '/webhooks': { name: 'Webhook Logs', breadcrumb: 'System / Webhooks' },
    '/audit-logs': { name: 'Audit Logs', breadcrumb: 'System / Security' },
    '/system': { name: 'System Health', breadcrumb: 'System / Health' },
    '/settings': { name: 'Platform Settings', breadcrumb: 'System / Settings' },
    '/cms/banners': { name: 'Banners', breadcrumb: 'CMS / Banners' },
    '/cms/testimonials': { name: 'Testimonials', breadcrumb: 'CMS / Testimonials' },
    '/cms/faqs': { name: 'FAQs', breadcrumb: 'CMS / FAQs' },
    '/cms/subscribers': { name: 'Newsletter Subscribers', breadcrumb: 'CMS / Subscribers' },
    '/cms/blogs': { name: 'Blog Posts', breadcrumb: 'CMS / Blog Posts' },
    '/cms/pages': { name: 'Custom Pages', breadcrumb: 'CMS / Custom Pages' },
    '/cms/contacts': { name: 'Contact Inquiries', breadcrumb: 'CMS / Inquiries' },
    '/cms/storefront-settings': { name: 'Storefront Settings', breadcrumb: 'CMS / Settings' },
  };
  const key = Object.keys(map).find(k => pathname.startsWith(k) && (k === pathname || pathname[k.length] === '/')) ?? '/dashboard';
  return map[key] ?? { name: 'Super Admin', breadcrumb: 'Dashboard' };
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const clock = useClock();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const { name: pageName, breadcrumb } = getPageTitle(location.pathname);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* clear local state regardless */ }
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.username?.slice(0, 2).toUpperCase() ?? 'SA');

  return (
    <div className="sa-app">
      <div
        className={`sa-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sa-sidebar-logo">
          <div className="sa-sidebar-logo-icon">
            <Zap size={20} color="white" />
          </div>
          <div className="sa-sidebar-logo-text">
            <div className="sa-sidebar-logo-title">HQ Investment</div>
            <div className="sa-sidebar-logo-sub">Super Admin</div>
          </div>
        </div>

        <nav className="sa-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div key={item.to}>
              {item.section && (
                <div className="sa-sidebar-section-label">{item.section}</div>
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="sa-nav-item-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && item.badge.value > 0 && (
                  <span className={`sa-nav-item-badge ${item.badge.type}`}>
                    {item.badge.value}
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-sidebar-user">
            <div className="sa-sidebar-user-avatar">{initials}</div>
            <div className="sa-sidebar-user-info">
              <div className="sa-sidebar-user-name">
                {user?.fullName || user?.username}
              </div>
              <div className="sa-sidebar-user-role">Platform Admin</div>
            </div>
            <button
              className="sa-sidebar-logout-btn"
              onClick={handleLogout}
              title="Sign out"
              type="button"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <button
            className="sa-topbar-hamburger"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
            type="button"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="sa-topbar-title">
            <div className="sa-topbar-page-name">{pageName}</div>
            <div className="sa-topbar-breadcrumb">{breadcrumb}</div>
          </div>

          <div className="sa-topbar-actions">
            <div className="sa-topbar-time">
              {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="sa-platform-badge">
              <span className="sa-platform-badge-dot" />
              <span>Platform Admin</span>
            </div>
          </div>
        </header>

        <main className="sa-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
