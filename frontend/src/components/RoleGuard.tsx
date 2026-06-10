/**
 * RoleGuard — frontend route-level RBAC enforcement.
 *
 * Wraps routes that should only be accessible to certain roles.
 * Users who don't have the required role are redirected to /dashboard
 * rather than seeing a blank page or a cryptic error.
 *
 * Usage in App.tsx:
 *   <Route element={<RoleGuard roles={['SUPER_ADMIN']} />}>
 *     <Route path="/payment-channels" element={<PaymentChannels />} />
 *   </Route>
 *
 * Note: This is a UI-layer guard only. The real security enforcement
 * happens in the backend API (HTTP 403 responses). This guard just
 * prevents non-authorized users from navigating to pages they can't use.
 */

import { Navigate, Outlet } from 'react-router-dom';
import authStore from '../stores/authStore';

type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT' | 'VIEWER';

interface RoleGuardProps {
    /** Roles that are allowed to access the wrapped routes */
    roles: AppRole[];
    /** Where to redirect if the user's role isn't in the allowed list (default: /dashboard) */
    redirectTo?: string;
}

export default function RoleGuard({ roles, redirectTo = '/dashboard' }: RoleGuardProps) {
    const { user } = authStore.useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!roles.includes(user.role as AppRole)) {
        return <Navigate to={redirectTo} replace />;
    }

    return <Outlet />;
}
