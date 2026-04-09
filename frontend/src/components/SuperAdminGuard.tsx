import { Navigate, Outlet } from 'react-router-dom';
import authStore from '../stores/authStore';

export default function SuperAdminGuard() {
    const { user } = authStore.useAuth();

    if (user?.role !== 'SUPER_ADMIN') {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
