import { useNavigate } from 'react-router-dom';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import authStore from '../stores/authStore';

export default function PendingApproval() {
    const navigate = useNavigate();
    const { logout } = authStore;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-lighter)', alignItems: 'center', paddingTop: '4rem', fontFamily: 'var(--font-family)' }}>
            <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2.5rem 2rem', textAlign: 'center', boxShadow: 'var(--shadow-md)', borderTop: '4px solid #f59e0b' }}>
                <div style={{ margin: '0 auto', width: 72, height: 72, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <HourglassEmptyIcon style={{ fontSize: 36 }} />
                </div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>You're Almost In!</h1>
                
                <div style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    <p style={{ marginBottom: '1rem' }}>Thanks for registering with HQInvestment Billing!</p>
                    <p>Your account is currently being reviewed by our team. This usually takes less than 24 hours. Once approved, your <strong>10-day free trial</strong> will activate automatically and you'll receive a confirmation by email and SMS.</p>
                </div>

                <button className="btn btn-secondary" onClick={handleLogout} style={{ width: '100%', border: '1px solid var(--border)', fontSize: '0.9rem', padding: '10px 0' }}>
                    Sign Out
                </button>
            </div>
            
            <div style={{ marginTop: 'auto', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                &copy; {new Date().getFullYear()} HQInvestment Billing
            </div>
        </div>
    );
}
