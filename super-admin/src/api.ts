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
