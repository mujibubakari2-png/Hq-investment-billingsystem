import { Navigate, Outlet } from 'react-router-dom';
import authStore from '../stores/authStore';

export default function ProtectedRoute() {
    const { isAuthenticated } = authStore.useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
