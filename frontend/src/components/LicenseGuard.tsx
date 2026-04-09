import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { licenseApi } from '../api/client';
import authStore from '../stores/authStore';

const BYPASS_PATHS = ['/restricted', '/renew', '/pending-approval'];

export default function LicenseGuard() {
    const { user } = authStore.useAuth();
    const location = useLocation();
    const [status, setStatus] = useState<'checking' | 'active' | 'restricted' | 'pending_approval'>('checking');

    useEffect(() => {
        let mounted = true;
        
        async function checkLicense() {
            try {
                if (user?.role === 'SUPER_ADMIN') {
                    if (mounted) setStatus('active');
                    return;
                }

                const res = await licenseApi.getLicense();
                if (mounted) {
                    if (res.status === 'PENDING_APPROVAL') {
                        setStatus('pending_approval');
                    } else if (res.status === 'SUSPENDED' || res.status === 'CANCELLED') {
                        // Trust the backend status — it already auto-suspends when expiry passes.
                        // Do NOT use daysRemaining <= 0 here: tenants with no expiry date
                        // get daysRemaining = 0 by default but remain ACTIVE.
                        setStatus('restricted');
                    } else {
                        setStatus('active');
                    }
                }
            } catch (err) {
                console.error('Failed to check license', err);
                if (mounted) setStatus('active'); // fail open on network error
            }
        }
        
        checkLicense();
        
        return () => {
            mounted = false;
        };
    }, [user?.role]);

    if (status === 'checking') {
        return (
            <div style={{
                height: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem'
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '3px solid var(--border-light)',
                    borderTopColor: 'var(--primary)',
                    animation: 'spin 0.8s linear infinite'
                }} />
                Verifying account status...
            </div>
        );
    }

    // Allow pending_approval users to access /renew so they can pay to activate
    if (status === 'pending_approval' && !BYPASS_PATHS.includes(location.pathname)) {
        return <Navigate to="/pending-approval" replace />;
    }

    if (status === 'restricted' && !BYPASS_PATHS.includes(location.pathname)) {
        return <Navigate to="/restricted" replace />;
    }

    return <Outlet />;
}
