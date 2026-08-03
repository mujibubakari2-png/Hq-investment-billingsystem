import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TenantsPage = lazy(() => import('./pages/TenantsPage'));
const TenantDetailPage = lazy(() => import('./pages/TenantDetailPage'));
const LicensesPage = lazy(() => import('./pages/LicensesPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const SaasPlansPage = lazy(() => import('./pages/SaasPlansPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminsPage = lazy(() => import('./pages/AdminsPage'));
const SystemPage = lazy(() => import('./pages/SystemPage'));
const WebhooksPage = lazy(() => import('./pages/WebhooksPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const EcommercePage = lazy(() => import('./pages/EcommercePage'));
const ProductsPage = lazy(() => import('./pages/ecommerce/ProductsPage'));
const ProductFormPage = lazy(() => import('./pages/ecommerce/ProductFormPage'));
const CategoriesPage = lazy(() => import('./pages/ecommerce/CategoriesPage'));
const OrdersPage = lazy(() => import('./pages/ecommerce/OrdersPage'));
const ReviewsPage = lazy(() => import('./pages/ecommerce/ReviewsPage'));
const BrandsPage = lazy(() => import('./pages/ecommerce/BrandsPage'));
const CollectionsPage = lazy(() => import('./pages/ecommerce/CollectionsPage'));
const WarehousesPage = lazy(() => import('./pages/ecommerce/WarehousesPage'));
const ShippingPage = lazy(() => import('./pages/ecommerce/ShippingPage'));
const TaxesPage = lazy(() => import('./pages/ecommerce/TaxesPage'));
const CouponsPage = lazy(() => import('./pages/ecommerce/CouponsPage'));
const FlashSalesPage = lazy(() => import('./pages/ecommerce/FlashSalesPage'));
const InventoryPage = lazy(() => import('./pages/ecommerce/InventoryPage'));
const CustomersPage = lazy(() => import('./pages/ecommerce/CustomersPage'));
const PromotionsPage = lazy(() => import('./pages/ecommerce/PromotionsPage'));
const MenusPage = lazy(() => import('./pages/ecommerce/MenusPage'));
const MediaLibraryPage = lazy(() => import('./pages/ecommerce/MediaLibraryPage'));
const ApiKeysPage = lazy(() => import('./pages/developer/ApiKeysPage'));
const BannersPage = lazy(() => import('./pages/cms/BannersPage'));
const TestimonialsPage = lazy(() => import('./pages/cms/TestimonialsPage'));
const FaqsPage = lazy(() => import('./pages/cms/FaqsPage'));
const SubscribersPage = lazy(() => import('./pages/cms/SubscribersPage'));
const BlogsPage = lazy(() => import('./pages/cms/BlogsPage'));
const PagesPage = lazy(() => import('./pages/cms/PagesPage'));
const ContactsPage = lazy(() => import('./pages/cms/ContactsPage'));
const StorefrontSettingsPage = lazy(() => import('./pages/cms/StorefrontSettingsPage'));
const MainLayout = lazy(() => import('./components/MainLayout'));

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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/tenants/:id" element={<TenantDetailPage />} />
            <Route path="/licenses" element={<LicensesPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/plans" element={<SaasPlansPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/ecommerce" element={<EcommercePage />} />
            <Route path="/ecommerce/products" element={<ProductsPage />} />
            <Route path="/ecommerce/products/new" element={<ProductFormPage />} />
            <Route path="/ecommerce/products/:id" element={<ProductFormPage />} />
            <Route path="/ecommerce/categories" element={<CategoriesPage />} />
            <Route path="/ecommerce/orders" element={<OrdersPage />} />
            <Route path="/ecommerce/reviews" element={<ReviewsPage />} />
            <Route path="/ecommerce/brands" element={<BrandsPage />} />
            <Route path="/ecommerce/collections" element={<CollectionsPage />} />
            <Route path="/ecommerce/warehouses" element={<WarehousesPage />} />
            <Route path="/ecommerce/shipping" element={<ShippingPage />} />
            <Route path="/ecommerce/taxes" element={<TaxesPage />} />
            <Route path="/ecommerce/coupons" element={<CouponsPage />} />
            <Route path="/ecommerce/flash-sales" element={<FlashSalesPage />} />
            <Route path="/ecommerce/inventory" element={<InventoryPage />} />
            <Route path="/ecommerce/customers" element={<CustomersPage />} />
            <Route path="/ecommerce/promotions" element={<PromotionsPage />} />
            <Route path="/ecommerce/menus" element={<MenusPage />} />
            <Route path="/ecommerce/media-library" element={<MediaLibraryPage />} />
            <Route path="/ecommerce/developer" element={<ApiKeysPage />} />
            <Route path="/ecommerce/:module" element={<EcommercePage />} />

            <Route path="/cms/banners" element={<BannersPage />} />
            <Route path="/cms/testimonials" element={<TestimonialsPage />} />
            <Route path="/cms/faqs" element={<FaqsPage />} />
            <Route path="/cms/subscribers" element={<SubscribersPage />} />
            <Route path="/cms/blogs" element={<BlogsPage />} />
            <Route path="/cms/pages" element={<PagesPage />} />
            <Route path="/cms/contacts" element={<ContactsPage />} />
            <Route path="/cms/storefront-settings" element={<StorefrontSettingsPage />} />

            <Route path="/admins" element={<AdminsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/system" element={<SystemPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
