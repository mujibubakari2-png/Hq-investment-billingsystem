/**
 * Super Admin API Client
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * All requests in this module go to /api/super-admin/* endpoints ONLY.
 * No endpoint here can expose individual tenant operational data.
 * Authentication uses sa_accessToken (separate cookie from tenant app).
 * ──────────────────────────────────────────────────────────────────────────────
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined ?? '').replace(/\/$/, '');
const BASE = `${API_BASE}/api/super-admin`;

// In-memory token storage (Super Admin uses separate token from tenant app)
let _saToken: string | null = null;
let _csrfToken: string | null = null;

export function setSaToken(token: string | null) {
  _saToken = token;
  if (token) localStorage.setItem('sa_token', token);
  else localStorage.removeItem('sa_token');
}

export function getSaToken(): string | null {
  return _saToken ?? localStorage.getItem('sa_token');
}

export function clearSaAuth() {
  _saToken = null;
  localStorage.removeItem('sa_token');
  localStorage.removeItem('sa_user');
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? m[2] : null;
}

async function fetchCsrf(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' });
    const t = res.headers.get('x-csrf-token');
    if (t) _csrfToken = t;
    return _csrfToken;
  } catch { return null; }
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getSaToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const csrf = getCookie('csrf-token') || _csrfToken;
  if (csrf) h['x-csrf-token'] = csrf;
  return h;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const method = init?.method?.toUpperCase() || 'GET';

  // Ensure CSRF token exists for mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!getCookie('csrf-token') && !_csrfToken) {
      await fetchCsrf();
    }
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...getHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  // Capture fresh CSRF token
  const newCsrf = res.headers.get('x-csrf-token');
  if (newCsrf) _csrfToken = newCsrf;

  // Auto-refresh on 401 (token expired)
  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    try {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json() as { token: string };
        setSaToken(refreshData.token);
        // Retry original request with new token
        const retryRes = await fetch(url, {
          ...init,
          credentials: 'include',
          headers: { ...getHeaders(), ...(init?.headers as Record<string, string> | undefined) },
        });
        if (retryRes.ok) {
          return retryRes.json() as Promise<T>;
        }
      }
    } catch { /* refresh failed */ }
    clearSaAuth();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  let data: unknown;
  try { data = await res.json(); } catch {
    throw new Error(`Server error: ${res.status} ${res.statusText}`);
  }

  if (!res.ok) {
    const d = data as { error?: string; message?: string };
    throw new Error(d?.error || d?.message || `Request failed (${res.status})`);
  }

  return data as T;
}

const get  = <T>(p: string) => request<T>(p);
const post = <T>(p: string, b: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(b) });
const patch = <T>(p: string, b: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(b) });
const put = <T>(p: string, b: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(b) });
const del  = <T>(p: string, b?: unknown) => request<T>(p, { method: 'DELETE', body: b ? JSON.stringify(b) : undefined });

// ── API Modules ──────────────────────────────────────────────────────────────

export interface SAUser {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
  isPlatformAdmin: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIALLING' | 'PENDING_APPROVAL' | 'INACTIVE';
  planId: string;
  planName: string | null;
  planPrice: number | null;
  createdAt: string;
  trialStart: string | null;
  trialEnd: string | null;
  licenseExpiresAt: string | null;
  primaryAdmin: { fullName: string | null; email: string; phone: string | null } | null;
}

export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  pppoeLimit: number;
  hotspotLimit: number | null;
  maxRouters: number;
  tenantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantLicense {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  tenantStatus: string;
  planId: string;
  planName: string;
  planPrice: number;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OverviewData {
  overview: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    triallingTenants: number;
    pendingTenants: number;
    expiredTenants: number;
  };
  revenue: { platformMRR: number; lastMonthMRR: number; mrrTrend: number };
  alerts: { expiringIn7Days: number; expiringIn30Days: number };
  planDistribution: Array<{ id: string; name: string; price: number; tenantCount: number }>;
  recentPayments: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantEmail: string;
    tenantStatus: string;
    amount: number;
    paymentMethod: string;
    status: string;
    invoiceNumber: string | null;
    createdAt: string;
  }>;
  recentTenants: Array<{ id: string; name: string; email: string; status: string; planName: string | null; createdAt: string }>;
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  performedBy: { id: string; username: string; email: string; fullName: string | null };
}

export interface PlatformSetting {
  id: string;
  key: string;
  group: string;
  value: string;
}

// Auth API
export const authApi = {
  login: (body: { username: string; password: string }) =>
    post<{ token: string; user: SAUser }>('/auth/login', body),
  me: () => get<SAUser>('/auth/me'),
  logout: () => post<{ message: string }>('/auth/logout', {}),
};

// Overview/Dashboard
export const overviewApi = {
  get: () => get<OverviewData>('/overview'),
};

// Tenants
export const tenantsApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<{ data: Tenant[]; total: number; page: number; limit: number; pages: number }>(`/tenants${q}`);
  },
  get: (id: string) => get<Tenant & { adminUsers: unknown[]; licenseHistory: unknown[]; paymentHistory: unknown[]; invoiceHistory: unknown[] }>(`/tenants/${id}`),
  create: (body: unknown) => post<{ message: string; tenant: Tenant; credentials: { adminEmail: string; tempPassword: string; note: string } }>('/tenants', body),
  update: (id: string, body: unknown) => patch<{ message: string; tenant: { id: string; status: string } }>(`/tenants/${id}`, body),
  delete: (id: string, confirmName: string) => del<{ message: string }>(`/tenants/${id}`, { confirmName }),
};

// SaaS Plans
export const plansApi = {
  list: () => get<{ data: SaasPlan[] }>('/saas-plans'),
  create: (body: unknown) => post<{ message: string; plan: SaasPlan }>('/saas-plans', body),
  update: (id: string, body: unknown) => patch<{ message: string; plan: SaasPlan }>(`/saas-plans/${id}`, body),
  delete: (id: string) => del<{ message: string }>(`/saas-plans/${id}`),
};

// Licenses
export const licensesApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<{ data: TenantLicense[]; total: number; page: number; pages: number }>(`/licenses${q}`);
  },
  create: (body: unknown) => post<{ message: string; license: TenantLicense }>('/licenses', body),
};

// Audit Logs
export const auditApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<{ data: AuditLog[]; total: number; page: number; pages: number }>(`/audit-logs${q}`);
  },
};

// Settings
export const settingsApi = {
  get: () => get<{ data: PlatformSetting[] }>('/settings'),
  save: (settings: Array<{ key: string; value: string; group?: string }>) =>
    post<{ message: string; count: number }>('/settings', { settings }),
};

// Platform Invoices (SaaS billing to tenants)
export interface TenantInvoiceItem {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  tenantStatus: string;
  planId: string;
  planName: string;
  planPrice: number;
  amount: number;
  packageMonths: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    transactionId: string | null;
  }>;
}

export const invoicesApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<{ data: TenantInvoiceItem[]; total: number; page: number; pages: number }>(`/invoices${q}`);
  },
  create: (body: unknown) => post<{ message: string; invoice: TenantInvoiceItem }>('/invoices', body),
  confirmPayment: (invoiceId: string) =>
    post<{ message: string }>('/invoices', { action: 'confirm_payment', invoiceId }),
};

// ── Platform Admins ───────────────────────────────────────────────────────────
export interface PlatformAdmin {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export const adminsApi = {
  list: () => get<{ data: PlatformAdmin[]; total: number }>('/admins'),
  create: (body: unknown) => post<{ message: string; admin: PlatformAdmin; credentials: { email: string; tempPassword: string; note: string } }>('/admins', body),
  update: (id: string, body: unknown) => patch<{ message: string; admin: PlatformAdmin }>(`/admins/${id}`, body),
  resetPassword: (id: string) => patch<{ message: string; tempPassword: string }>(`/admins/${id}`, { action: 'reset_password' }),
  toggleStatus: (id: string, status: string) => patch<{ message: string }>(`/admins/${id}`, { action: 'toggle_status', status }),
  delete: (id: string) => del<{ message: string }>(`/admins/${id}`),
};

// ── System Health ─────────────────────────────────────────────────────────────
export interface SystemHealth {
  status: string;
  timestamp: string;
  uptime_sec: number;
  environment: string;
  node_version: string;
  response_ms: number;
  database: { connected: boolean; latency_ms?: number; schema_verified?: boolean; status: string };
  redis: { connected: boolean; latency_ms?: number; status: string };
  queue: { waiting?: number; active?: number; failed?: number; delayed?: number; completed?: number; status: string };
  memory: { heap_used_mb: number; heap_total_mb: number; rss_mb: number; usage_pct: number; status: string };
  platform_stats: { totalTenants: number; activeTenants: number; pendingTenants: number; totalInvoices: number; pendingPayments: number };
  cron_jobs: Array<{ name: string; schedule: string; endpoint: string }>;
  diagnostics?: string[];
}

export const systemApi = {
  health: () => get<SystemHealth>('/system'),
};

// ── Webhook Logs ──────────────────────────────────────────────────────────────
export interface WebhookLog {
  id: string;
  provider: string;
  event: string;
  transactionRef: string | null;
  verified: boolean;
  createdAt: string;
  payloadSummary: { amount?: unknown; status?: unknown; order_status?: unknown; reference?: unknown; order_id?: unknown } | null;
}

export const webhooksApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<{ data: WebhookLog[]; total: number; page: number; pages: number; providers: string[] }>(`/webhooks${q}`);
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────
export interface NotificationRecord {
  id: string;
  tenantId: string | null;
  tenantName: string;
  recipient: string;
  message: string;
  status: string;
  type: string;
  createdAt: string;
  sentAt: string | null;
}

export const notificationsApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<{ data: NotificationRecord[]; total: number; page: number; pages: number }>(`/notifications${q}`);
  },
  send: (body: { channel: string; tenantId?: string; subject?: string; message: string }) =>
    post<{ message: string; successCount: number; failCount: number }>('/notifications', body),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export interface ReportsData {
  kpis: {
    totalRevenue: number;
    totalTenants: number;
    activeTenants: number;
    churnRate: number;
    currentMonthRevenue: number;
    mrrGrowthPct: number;
    overdueInvoices: number;
    expiringSoon: number;
  };
  mrrTrend: Array<{ month: string; revenue: number }>;
  tenantGrowth: Array<{ month: string; count: number }>;
  revenueByPlan: Array<{ planId: string; planName: string; revenue: number; invoiceCount: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

export const reportsApi = {
  get: (period = '12') => get<ReportsData>(`/reports?period=${period}`),
};

// ── E-Commerce ────────────────────────────────────────────────────────────────
export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  brand: string | null;
  price: string | number;
  discountType: string;
  discountValue: string | number | null;
  currency: string;
  quantity: number;
  status: string;
  featured: boolean;
  category?: { id: string; name: string };
  images?: { id: string; url: string; isFeatured: boolean }[];
  createdAt: string;
}

export interface EcomOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  totalAmount: string | number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  _count?: { items: number };
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: 'COUPON' | 'FLASH_SALE' | 'DISCOUNT';
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
  discountValue: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  totalOrders: number;
  totalSpent: number;
  lastActive: string;
  notes?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  product?: any; // Add Product interface if needed
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  fileType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  mimeType?: string;
  sizeBytes: number;
  altText?: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export const ecommerceApi = {
  categories: {
    list: () => get<{ data: ProductCategory[] }>('/ecommerce/categories'),
    create: (body: Partial<ProductCategory>) => post<{ data: ProductCategory }>('/ecommerce/categories', body),
    update: (id: string, body: Partial<ProductCategory>) => put<{ data: ProductCategory }>(`/ecommerce/categories/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/categories/${id}`)
  },
  products: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: Product[]; total: number; page: number; pages: number }>(`/ecommerce/products${q}`);
    },
    get: (id: string) => get<{ data: Product }>(`/ecommerce/products/${id}`),
    create: (body: any) => post<{ data: Product }>('/ecommerce/products', body),
    update: (id: string, body: any) => put<{ data: Product }>(`/ecommerce/products/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/products/${id}`)
  },
  orders: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: EcomOrder[]; total: number; page: number; pages: number }>(`/ecommerce/orders${q}`);
    },
    get: (id: string) => get<{ data: EcomOrder }>(`/ecommerce/orders/${id}`),
    update: (id: string, body: { status?: string; paymentStatus?: string }) => put<{ data: EcomOrder }>(`/ecommerce/orders/${id}`, body)
  },
  reviews: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/reviews${q}`);
    },
    update: (id: string, body: { isApproved: boolean }) => put<{ data: any }>(`/ecommerce/reviews/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/reviews/${id}`)
  },
  brands: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/brands${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/brands', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/brands/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/brands/${id}`)
  },
  collections: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/collections${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/collections', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/collections/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/collections/${id}`)
  },
  warehouses: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/warehouses${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/warehouses', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/warehouses/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/warehouses/${id}`)
  },
  shipping: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/shipping${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/shipping', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/shipping/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/shipping/${id}`)
  },
  taxes: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/taxes${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/taxes', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/taxes/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/taxes/${id}`)
  },
  coupons: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/coupons${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/coupons', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/coupons/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/coupons/${id}`)
  },
  flashSales: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/ecommerce/flash-sales${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/flash-sales', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/flash-sales/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/flash-sales/${id}`)
  },
  inventory: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; meta: any }>(`/ecommerce/inventory${q}`);
    },
    addMovement: (body: any) => post<{ data: any }>('/ecommerce/inventory', body)
  },
  customers: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; meta: any }>(`/ecommerce/customers${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/customers', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/customers/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/customers/${id}`)
  },
  menus: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; meta: any }>(`/ecommerce/menus${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/menus', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/menus/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/menus/${id}`)
  },
  media: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; meta: any }>(`/ecommerce/media${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/media', body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/media/${id}`)
  },
  promotions: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; meta: any }>(`/ecommerce/promotions${q}`);
    },
    create: (body: any) => post<{ data: any }>('/ecommerce/promotions', body),
    update: (id: string, body: any) => put<{ data: any }>(`/ecommerce/promotions/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/ecommerce/promotions/${id}`)
  }
};

export const developerApi = {
  apiKeys: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; meta: any }>(`/developer/api-keys${q}`);
    },
    create: (body: any) => post<{ rawKey: string; message: string }>('/developer/api-keys', body),
    revoke: (id: string) => del<{ message: string }>(`/developer/api-keys/${id}`)
  }
};

// ── CMS ───────────────────────────────────────────────────────────────────────
export const cmsApi = {
  settings: {
    get: () => get<{ data: Record<string, any> }>('/cms/settings'),
    update: (body: Record<string, any>) => put<{ message: string }>('/cms/settings', body),
  },
  banners: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/banners${q}`);
    },
    create: (body: any) => post<{ data: any }>('/cms/banners', body),
    update: (id: string, body: any) => put<{ data: any }>(`/cms/banners/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/cms/banners/${id}`)
  },
  testimonials: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/testimonials${q}`);
    },
    create: (body: any) => post<{ data: any }>('/cms/testimonials', body),
    update: (id: string, body: any) => put<{ data: any }>(`/cms/testimonials/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/cms/testimonials/${id}`)
  },
  faqs: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/faqs${q}`);
    },
    create: (body: any) => post<{ data: any }>('/cms/faqs', body),
    update: (id: string, body: any) => put<{ data: any }>(`/cms/faqs/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/cms/faqs/${id}`)
  },
  subscribers: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/subscribers${q}`);
    }
  },
  blogs: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/blogs${q}`);
    },
    create: (body: any) => post<{ data: any }>('/cms/blogs', body),
    update: (id: string, body: any) => put<{ data: any }>(`/cms/blogs/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/cms/blogs/${id}`)
  },
  pages: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/pages${q}`);
    },
    create: (body: any) => post<{ data: any }>('/cms/pages', body),
    update: (id: string, body: any) => put<{ data: any }>(`/cms/pages/${id}`, body),
    delete: (id: string) => del<{ message: string }>(`/cms/pages/${id}`)
  },
  contacts: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return get<{ data: any[]; total: number; page: number; pages: number }>(`/cms/contacts${q}`);
    },
    updateStatus: (id: string, status: string) => put<{ data: any }>(`/cms/contacts/${id}`, { status }),
    delete: (id: string) => del<{ message: string }>(`/cms/contacts/${id}`)
  }
};

