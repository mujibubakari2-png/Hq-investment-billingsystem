import { Navigate, Outlet } from 'react-router-dom';
import authStore from '../stores/authStore';

export default function SuperAdminGuard() {
    const { user } = authStore.useAuth();
    const isPlatformAdmin = user?.isPlatformAdmin === true || (user?.role === 'SUPER_ADMIN' && !user?.tenantId);

    if (!isPlatformAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
