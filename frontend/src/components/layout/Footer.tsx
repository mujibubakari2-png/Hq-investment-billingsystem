import authStore from '../../stores/authStore';

export default function Footer() {
    const { user } = authStore.useAuth();
    const tenantName = user?.fullName || 'HQ INVESTMENT';

    const year = new Date().getFullYear();

    return (
        <footer className="app-footer">
            <span className="app-footer-text">&copy; {year} {tenantName}</span>
            <div className="app-footer-row">
                <span className="app-footer-text">Powered by</span>
                <span className="app-footer-brand">HQ INVESTMENT BILLING</span>
                <span className="app-footer-icon">✨</span>
            </div>
        </footer>
    );
}
