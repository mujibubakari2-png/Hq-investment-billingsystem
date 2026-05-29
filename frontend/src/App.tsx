import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// E18 FIX: Import ErrorBoundary — prevents a single component crash from blanking the entire app
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-loaded pages (code splitting — each page is its own JS chunk) ────────
const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));
const LicenseGuard = lazy(() => import('./components/LicenseGuard'));
const SuperAdminGuard = lazy(() => import('./components/SuperAdminGuard'));

const Restricted = lazy(() => import('./pages/Restricted'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const RenewLicense = lazy(() => import('./pages/RenewLicense'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const ActiveSubscribers = lazy(() => import('./pages/ActiveSubscribers'));
const ExpiredSubscribers = lazy(() => import('./pages/ExpiredSubscribers'));
const Packages = lazy(() => import('./pages/Packages'));
const VoucherCodes = lazy(() => import('./pages/VoucherCodes'));
const AllTransactions = lazy(() => import('./pages/AllTransactions'));
const MobileTransactions = lazy(() => import('./pages/MobileTransactions'));
const ExpenseTracking = lazy(() => import('./pages/ExpenseTracking'));
const Mikrotiks = lazy(() => import('./pages/Mikrotiks'));
const Equipments = lazy(() => import('./pages/Equipments'));
const SmsMessages = lazy(() => import('./pages/SmsMessages'));
const MessageTemplates = lazy(() => import('./pages/MessageTemplates'));
const SystemSettings = lazy(() => import('./pages/SystemSettings'));
const PaymentChannels = lazy(() => import('./pages/PaymentChannels'));
const SystemUsers = lazy(() => import('./pages/SystemUsers'));
const LicenseManagement = lazy(() => import('./pages/LicenseManagement'));
const TechnicalSupport = lazy(() => import('./pages/TechnicalSupport'));
const RechargeAccount = lazy(() => import('./pages/RechargeAccount'));
const EditPlan = lazy(() => import('./pages/EditPlan'));
const AddPackage = lazy(() => import('./pages/AddPackage'));
const EditPackage = lazy(() => import('./pages/EditPackage'));
const RouterSetupWizard = lazy(() => import('./pages/RouterSetupWizard'));
const SendBulkMessage = lazy(() => import('./pages/SendBulkMessage'));
const HotspotLoginCustomizer = lazy(() => import('./pages/HotspotLoginCustomizer'));
const BankPaymentConfig = lazy(() => import('./pages/BankPaymentConfig'));
const MpesaTillConfig = lazy(() => import('./pages/MpesaTillConfig'));
const HarakaPayConfig = lazy(() => import('./pages/HarakaPayConfig'));
const MpesaPaybillConfig = lazy(() => import('./pages/MpesaPaybillConfig'));
const PalmPesaConfig = lazy(() => import('./pages/PalmPesaConfig'));
const ZenoPayConfig = lazy(() => import('./pages/ZenoPayConfig'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Reports = lazy(() => import('./pages/Reports'));
const TutorialVideos = lazy(() => import('./pages/TutorialVideos'));
const Invoices = lazy(() => import('./pages/Invoices'));
const SystemTenants = lazy(() => import('./pages/SystemTenants'));
const Profile = lazy(() => import('./pages/Profile'));
const VpnManagement = lazy(() => import('./pages/VpnManagement'));

// ── Loading spinner shown while a lazy page chunk is downloading ──────────────
function PageLoader() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      color: 'var(--text-secondary)',
      fontFamily: 'inherit',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid var(--border, #e5e7eb)',
        borderTopColor: 'var(--primary, #6366f1)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '0.85rem' }}>Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* E18 FIX: ErrorBoundary wraps all routes so a crash in any page */}
      {/* renders a friendly recovery screen instead of a blank white page  */}
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Standalone pages (no sidebar layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected pages with sidebar layout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/restricted" element={<Restricted />} />
            <Route path="/renew" element={<RenewLicense />} />

            <Route element={<LicenseGuard />}>
              <Route element={<MainLayout />}>
                {/* MAIN */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* SYSTEM ADMINISTRATION (SUPER_ADMIN ONLY) */}
                <Route element={<SuperAdminGuard />}>
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/system-tenants" element={<SystemTenants />} />
                </Route>

                {/* CLIENT MANAGEMENT */}
                <Route path="/clients" element={<Clients />} />
                <Route path="/active-subscribers" element={<ActiveSubscribers />} />
                <Route path="/expired-subscribers" element={<ExpiredSubscribers />} />

                {/* PACKAGE MANAGEMENT */}
                <Route path="/packages" element={<Packages />} />
                <Route path="/voucher-codes" element={<VoucherCodes />} />

                {/* FINANCE MANAGEMENT */}
                <Route path="/all-transactions" element={<AllTransactions />} />
                <Route path="/mobile-transactions" element={<MobileTransactions />} />
                <Route path="/expense-tracking" element={<ExpenseTracking />} />

                {/* NETWORK MANAGEMENT */}
                <Route path="/mikrotiks" element={<Mikrotiks />} />
                <Route path="/vpn-management" element={<VpnManagement />} />
                <Route path="/equipments" element={<Equipments />} />

                {/* COMMUNICATIONS */}
                <Route path="/sms-messages" element={<SmsMessages />} />
                <Route path="/message-templates" element={<MessageTemplates />} />
                <Route path="/send-bulk-message" element={<SendBulkMessage />} />

                {/* ADMINISTRATION */}
                <Route path="/system-settings" element={<SystemSettings />} />
                <Route path="/payment-channels" element={<PaymentChannels />} />
                <Route path="/system-users" element={<SystemUsers />} />
                <Route path="/license-management" element={<LicenseManagement />} />

                {/* REPORTS & HELP */}
                <Route path="/reports" element={<Reports />} />
                <Route path="/tutorial-videos" element={<TutorialVideos />} />
                <Route path="/technical-support" element={<TechnicalSupport />} />

                {/* ADDITIONAL PAGES */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/recharge" element={<RechargeAccount />} />
                <Route path="/edit-plan/:id" element={<EditPlan />} />
                <Route path="/add-package" element={<AddPackage />} />
                <Route path="/edit-package/:id" element={<EditPackage />} />
                <Route path="/router-setup/:id" element={<RouterSetupWizard />} />
                <Route path="/hotspot-customizer" element={<HotspotLoginCustomizer />} />
                <Route path="/bank-payment-config" element={<BankPaymentConfig />} />
                <Route path="/mpesa-till-config" element={<MpesaTillConfig />} />
                <Route path="/harakapay-config" element={<HarakaPayConfig />} />
                <Route path="/mpesa-paybill-config" element={<MpesaPaybillConfig />} />
                <Route path="/palmpesa-config" element={<PalmPesaConfig />} />
                <Route path="/zenopay-config" element={<ZenoPayConfig />} />
              </Route>
            </Route>
          </Route>

          {/* 404 — must be last */}
          <Route path="*" element={
            <div style={{
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              color: 'var(--text-secondary)',
              fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: '4rem', lineHeight: 1 }}>404</div>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Page Not Found</strong>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>The page you requested does not exist.</p>
              <a href="/dashboard" style={{
                marginTop: '0.5rem',
                padding: '0.5rem 1.25rem',
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: '0.9rem',
              }}>Go to Dashboard</a>
            </div>
          } />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
