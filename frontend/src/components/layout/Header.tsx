import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { licenseApi, type LicenseResponse } from '../../api/client';
import authStore from '../../stores/authStore';
import './Header.css';

interface HeaderProps {
    onToggleSidebar: () => void;
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

export default function Header({ onToggleSidebar, darkMode, onToggleDarkMode }: HeaderProps) {
    const { user } = authStore.useAuth();
    const navigate = useNavigate();
    const [showMenu, setShowMenu] = useState(false);
    const [license, setLicense] = useState<LicenseResponse | null>(null);

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') {
            licenseApi.getLicense().then(setLicense).catch(console.error);
        }
    }, [user?.role]);

    const displayName = user?.fullName || user?.username || 'User';

    const initials = displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U';

    const handleLogout = () => {
        authStore.logout();
        navigate('/login', { replace: true });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {license && typeof license.daysRemaining === 'number' && license.daysRemaining > 0 && license.daysRemaining <= 7 && (
                <div style={{ background: license.daysRemaining <= 2 ? '#fee2e2' : '#fef3c7', color: license.daysRemaining <= 2 ? '#991b1b' : '#92400e', padding: '10px 20px', textAlign: 'center', fontWeight: 'bold', borderBottom: `1px solid ${license.daysRemaining <= 2 ? '#fca5a5' : '#fde68a'}`, fontSize: '0.85rem' }}>
                    {license.daysRemaining <= 2 ? '🚨' : '⚠️'} Your account will be restricted in {license.daysRemaining} {license.daysRemaining === 1 ? 'day' : 'days'}. <span style={{ textDecoration: 'underline', cursor: 'pointer', marginLeft: 8 }} onClick={() => navigate('/renew')}>Renew now</span> to avoid service interruption!
                </div>
            )}
            <header className="header">
                <div className="header-left">
                    <button className="hamburger-btn" onClick={onToggleSidebar}>
                        <MenuIcon />
                    </button>
                </div>

            <div className="header-right">
                <button className="header-icon-btn" onClick={onToggleDarkMode}>
                    {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </button>

                <div className="header-user" style={{ position: 'relative' }}>
                    <div
                        className="header-avatar"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        {initials}
                    </div>

                    {showMenu && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '110%',
                                right: 0,
                                background: 'var(--bg-card, #fff)',
                                border: '1px solid var(--border, #e5e7eb)',
                                borderRadius: 10,
                                boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                                minWidth: 180,
                                zIndex: 999,
                                overflow: 'hidden',
                            }}
                        >
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: 2 }}>
                                    {user?.role}
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowMenu(false); navigate('/profile'); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    width: '100%', padding: '10px 16px',
                                    border: 'none', background: 'transparent',
                                    cursor: 'pointer', fontSize: '0.85rem',
                                    color: 'var(--text, #333)',
                                }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--hover, #f5f5f5)')}
                                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <PersonIcon fontSize="small" /> Profile
                            </button>
                            <button
                                onClick={handleLogout}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    width: '100%', padding: '10px 16px',
                                    border: 'none', background: 'transparent',
                                    cursor: 'pointer', fontSize: '0.85rem',
                                    color: '#e74c3c',
                                }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--hover, #f5f5f5)')}
                                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <LogoutIcon fontSize="small" /> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
        </div>
    );
}
