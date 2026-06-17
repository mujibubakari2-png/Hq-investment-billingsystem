import authStore from '../../stores/authStore';

export default function Footer() {
    const { user } = authStore.useAuth();
    const tenantName = user?.fullName || 'HQ Investment';

    return (
        <footer className="app-footer">
            <span className="app-footer-text">&copy; 2026 {tenantName}</span>
            <div className="app-footer-row">
                <span className="app-footer-text">Powered by</span>
                <span className="app-footer-brand">hq investmentbilling</span>
                <span className="app-footer-icon">✨</span>
            </div>
        </footer>
    );
}
