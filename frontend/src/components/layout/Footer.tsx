import authStore from '../../stores/authStore';

export default function Footer() {
    const { user } = authStore.useAuth();
    // Fallback to 'HQ Investment' if the user is not logged in or doesn't have a name
    const tenantName = user?.fullName || 'HQ Investment';

    return (
        <div style={{
            textAlign: 'center',
            padding: '12px 20px',
            color: '#e2e8f0',
            width: 'fit-content',
            alignSelf: 'center',
            marginTop: 'auto',
            marginBottom: '0', // Drop it all the way down to the page bottom
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            background: 'linear-gradient(90deg, #1e40af 0%, #0f172a 100%)',
            borderTop: '3px solid #3b82f6',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px', // Only top corners are rounded
            borderBottomLeftRadius: '0',
            borderBottomRightRadius: '0',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)'
        }}>
            <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.8rem' }}>
                &copy; 2026 {tenantName}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Powered by</span>
                <span style={{
                    fontWeight: 700,
                    color: '#60a5fa',
                    letterSpacing: '0.5px',
                    fontSize: '0.75rem'
                }}>
                    hq investmentbilling
                </span>
                <span style={{ fontSize: '0.9rem' }}>✨</span>
            </div>
        </div>
    );
}
