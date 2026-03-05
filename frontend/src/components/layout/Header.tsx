import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import './Header.css';

interface HeaderProps {
    onToggleSidebar: () => void;
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

export default function Header({ onToggleSidebar, darkMode, onToggleDarkMode }: HeaderProps) {
    return (
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

                <div className="header-user">
                    <div className="header-avatar">MB</div>
                </div>
            </div>
        </header>
    );
}
