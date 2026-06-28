import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import authStore from '../../stores/authStore';

function readTenantTheme(tenantKey: string) {
    try {
        const raw = localStorage.getItem(`tenant-theme:${tenantKey}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeTenantTheme(tenantKey: string, value: { darkMode: boolean; primaryColor: string; accentColor: string }) {
    try {
        localStorage.setItem(`tenant-theme:${tenantKey}`, JSON.stringify(value));
    } catch {
        // Ignore storage issues
    }
}

export default function MainLayout() {
    const location = useLocation();
    const { user } = authStore.useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);   // mobile drawer
    const [sidebarVisible, setSidebarVisible] = useState(true); // desktop toggle
    const [darkMode, setDarkMode] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#4f46e5');
    const [accentColor, setAccentColor] = useState('#0f766e');
    const [isMobile, setIsMobile] = useState(() => {
        return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    });

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) {
                setSidebarOpen(false); // close mobile drawer when going to desktop
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const tenantKey = (() => {
        const params = new URLSearchParams(location.search);
        return params.get('tenantId') || user?.tenantId || user?.id || 'default';
    })();

    useEffect(() => {
        const storedTheme = readTenantTheme(tenantKey);
        if (storedTheme) {
            setDarkMode(Boolean(storedTheme.darkMode));
            setPrimaryColor(storedTheme.primaryColor || '#4f46e5');
            setAccentColor(storedTheme.accentColor || '#0f766e');
        } else {
            setDarkMode(false);
            setPrimaryColor('#4f46e5');
            setAccentColor('#0f766e');
        }
    }, [tenantKey]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        document.documentElement.style.setProperty('--primary', primaryColor);
        document.documentElement.style.setProperty('--primary-hover', primaryColor);
        document.documentElement.style.setProperty('--primary-light', `${primaryColor}15`);
        document.documentElement.style.setProperty('--secondary', accentColor);
        document.documentElement.style.setProperty('--secondary-light', `${accentColor}15`);
        writeTenantTheme(tenantKey, { darkMode, primaryColor, accentColor });
    }, [darkMode, primaryColor, accentColor, tenantKey]);

    // Close mobile sidebar when clicking overlay
    const handleCloseMobile = useCallback(() => {
        setSidebarOpen(false);
    }, []);

    const handleToggleSidebar = useCallback(() => {
        if (isMobile) {
            setSidebarOpen(prev => !prev);
        } else {
            setSidebarVisible(prev => !prev);
        }
    }, [isMobile]);

    // On desktop: sidebar is always shown unless toggled off.
    // On mobile: sidebar is a drawer, controlled by sidebarOpen.
    const sidebarIsOpen = isMobile ? sidebarOpen : true;
    const sidebarCollapsed = !isMobile && !sidebarVisible;

    return (
        <div className="app-layout">
            <Sidebar
                isOpen={sidebarIsOpen}
                collapsed={sidebarCollapsed}
                onClose={handleCloseMobile}
            />

            <div
                className={`main-content${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
            >
                <Header
                    onToggleSidebar={handleToggleSidebar}
                    darkMode={darkMode}
                    onToggleDarkMode={() => setDarkMode(d => !d)}
                    primaryColor={primaryColor}
                    accentColor={accentColor}
                    onPrimaryColorChange={setPrimaryColor}
                    onAccentColorChange={setAccentColor}
                />
                <div className="page-content" style={{ flex: 1 }}>
                    <Outlet />
                </div>
                <Footer />
            </div>
        </div>
    );
}
