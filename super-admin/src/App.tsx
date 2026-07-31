import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const LoginPage          = lazy(() => import('./pages/LoginPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const TenantsPage        = lazy(() => import('./pages/TenantsPage'));
const TenantDetailPage   = lazy(() => import('./pages/TenantDetailPage'));
const LicensesPage       = lazy(() => import('./pages/LicensesPage'));
const InvoicesPage       = lazy(() => import('./pages/InvoicesPage'));
const SaasPlansPage      = lazy(() => import('./pages/SaasPlansPage'));
const AuditLogsPage      = lazy(() => import('./pages/AuditLogsPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const AdminsPage         = lazy(() => import('./pages/AdminsPage'));
const SystemPage         = lazy(() => import('./pages/SystemPage'));
const WebhooksPage       = lazy(() => import('./pages/WebhooksPage'));
const NotificationsPage  = lazy(() => import('./pages/NotificationsPage'));
const ReportsPage        = lazy(() => import('./pages/ReportsPage'));
const EcommercePage      = lazy(() => import('./pages/EcommercePage'));
const MainLayout         = lazy(() => import('./components/MainLayout'));

function PageLoader() {
  return (
    <div className="sa-loading-center" style={{ minHeight: '100vh' }}>
      <div className="sa-spinner" />
      <span>Loading…</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

          {/* Protected — all inside MainLayout */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"       element={<DashboardPage />} />
            <Route path="/tenants"         element={<TenantsPage />} />
            <Route path="/tenants/:id"     element={<TenantDetailPage />} />
            <Route path="/licenses"        element={<LicensesPage />} />
            <Route path="/invoices"        element={<InvoicesPage />} />
            <Route path="/plans"           element={<SaasPlansPage />} />
            <Route path="/reports"         element={<ReportsPage />} />
            <Route path="/ecommerce"       element={<EcommercePage />} />
            <Route path="/ecommerce/:module" element={<EcommercePage />} />
            <Route path="/admins"          element={<AdminsPage />} />
            <Route path="/notifications"   element={<NotificationsPage />} />
            <Route path="/webhooks"        element={<WebhooksPage />} />
            <Route path="/audit-logs"      element={<AuditLogsPage />} />
            <Route path="/system"          element={<SystemPage />} />
            <Route path="/settings"        element={<SettingsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
