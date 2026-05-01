import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth <= 768;
        }
        return false; // assume desktop on server
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    const handleToggleSidebar = () => {
        if (isMobile) {
            setSidebarOpen(!sidebarOpen);
        } else {
            setSidebarVisible(!sidebarVisible);
        }
    };

    return (
        <div className="app-layout">
            <Sidebar isOpen={isMobile ? sidebarOpen : sidebarVisible} onClose={() => setSidebarOpen(false)} />

            <div
                className={`main-content ${!sidebarVisible && !isMobile ? 'sidebar-collapsed' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
            >
                <Header
                    onToggleSidebar={handleToggleSidebar}
                    darkMode={darkMode}
                    onToggleDarkMode={() => setDarkMode(!darkMode)}
                />
                <div className="page-content" style={{ flex: 1 }}>
                    <Outlet />
                </div>
                <Footer />
            </div>
        </div>
    );
}
