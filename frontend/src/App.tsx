import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ActiveSubscribers from './pages/ActiveSubscribers';
import ExpiredSubscribers from './pages/ExpiredSubscribers';
import Packages from './pages/Packages';
import VoucherCodes from './pages/VoucherCodes';
import AllTransactions from './pages/AllTransactions';
import MobileTransactions from './pages/MobileTransactions';
import ExpenseTracking from './pages/ExpenseTracking';
import Mikrotiks from './pages/Mikrotiks';
import Equipments from './pages/Equipments';
import SmsMessages from './pages/SmsMessages';
import MessageTemplates from './pages/MessageTemplates';
import SystemSettings from './pages/SystemSettings';
import PaymentChannels from './pages/PaymentChannels';
import SystemUsers from './pages/SystemUsers';
import LicenseManagement from './pages/LicenseManagement';
import TechnicalSupport from './pages/TechnicalSupport';
import RechargeAccount from './pages/RechargeAccount';
import EditPlan from './pages/EditPlan';
import AddPackage from './pages/AddPackage';
import EditPackage from './pages/EditPackage';
import RouterSetupWizard from './pages/RouterSetupWizard';
import SendBulkMessage from './pages/SendBulkMessage';
import HotspotLoginCustomizer from './pages/HotspotLoginCustomizer';
import BankPaymentConfig from './pages/BankPaymentConfig';
import MpesaTillConfig from './pages/MpesaTillConfig';
import HarakaPayConfig from './pages/HarakaPayConfig';
import MpesaPaybillConfig from './pages/MpesaPaybillConfig';
import PalmPesaConfig from './pages/PalmPesaConfig';
import ZenoPayConfig from './pages/ZenoPayConfig';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Reports from './pages/Reports';
import TutorialVideos from './pages/TutorialVideos';
import Invoices from './pages/Invoices';
import Profile from './pages/Profile';
import VpnManagement from './pages/VpnManagement';
import AdminTenants from './pages/AdminTenants';


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone pages (no sidebar layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected pages with sidebar layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* MAIN */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* SYSTEM ADMINISTRATION (SUPER_ADMIN ONLY) */}
            <Route path="/admin-tenants" element={<AdminTenants />} />

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
            <Route path="/invoices" element={<Invoices />} />

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
      </Routes>
    </BrowserRouter>
  );
}
