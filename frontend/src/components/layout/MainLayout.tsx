import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);   // mobile drawer
    const [sidebarVisible, setSidebarVisible] = useState(true); // desktop toggle
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });
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

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

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
                />
                <div className="page-content" style={{ flex: 1 }}>
                    <Outlet />
                </div>
                <Footer />
            </div>
        </div>
    );
}
