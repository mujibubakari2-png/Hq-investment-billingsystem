// ── Central API client for the ISP Billing System ──────────────────────────

// In dev: VITE_API_URL is unset so BASE = '/api' (Vite dev proxy forwards to localhost:3001).
// In prod: VITE_API_URL = 'https://api.yourdomain.com' so calls go directly to the API.
const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';
// Remove trailing slash if present to avoid double slashes
export const CLEAN_API_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
const BASE = `${CLEAN_API_URL}/api`;

function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const fullUrl = `${BASE}${path}`;
    try {
        const res = await fetch(fullUrl, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders(),
                ...(init?.headers as Record<string, string>),
            },
        });

        if (res.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
            throw new Error('Unauthorized');
        }

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data as T;
    } catch (error: any) {
        console.error(`[API ERROR] ${init?.method || 'GET'} ${fullUrl}:`, error);
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error(`Unable to connect to the server at ${fullUrl}. Please check your internet connection or ensure VITE_API_URL is correctly set.`);
        }
        throw error;
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function get<T>(path: string) {
    return request<T>(path);
}

function post<T>(path: string, body: unknown) {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown) {
    return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

function del<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
}

export interface LicenseResponse {
    isSuperAdmin: boolean;
    companyName?: string;
    licenseKey?: string;
    status?: string;
    daysRemaining?: number;
    expiresAt?: string;
    customersCount?: number;
    clientLimit?: number;
    paidThisMonth?: number;
    hasOutstanding?: boolean;
    plan?: { id: string; name: string; price: number; };
    outstandingInvoices?: { id: string; amount: number; dueDate: string; status: string; }[];
    message?: string;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
    login: (username: string, password: string) =>
        post<{ token: string; user: { id: string; username: string; email: string; role: string; phone: string; fullName?: string } }>(
            '/auth/login',
            { username, password },
        ),
    me: () => get<{ id: string; username: string; email: string; role: string; phone: string; status: string; fullName?: string }>('/auth/me'),

    // Registration
    requestRegisterOtp: (data: { email: string; fullName: string }) =>
        post<{ message: string; otp: string }>('/auth/register/request-otp', data),
    verifyRegisterOtp: (data: { email: string; otp: string }) =>
        post<{ message: string }>('/auth/register/verify-otp', data),
    register: (data: {
        username: string;
        email: string;
        password: string;
        fullName: string;
        phone?: string;
    }) =>
        post<{ message: string; token: string; user: { id: string; username: string; email: string; role: string; phone?: string; fullName?: string } }>('/auth/register', data),

    // Password Recovery
    requestPasswordResetOtp: (data: { email?: string; phone?: string; identifier?: string }) =>
        post<{ message: string; otp?: string }>('/auth/forgot-password/request-otp', data),
    verifyPasswordResetOtp: (data: { email: string; otp: string }) =>
        post<{ message: string }>('/auth/forgot-password/verify-otp', data),
    resetPassword: (data: { email: string; otp: string; newPassword: string }) =>
        post<{ message: string }>('/auth/forgot-password/reset', data),
    googleLogin: (data: { credential: string; action: 'login' | 'register' }) =>
        post<{ message: string; token: string; user: { id: string; username: string; email: string; role: string; phone?: string; fullName?: string } }>('/auth/google', data),
};

// ── Profile ─────────────────────────────────────────────────────────────────

export const profileApi = {
    get: () => get<{ id: string; username: string; email: string; role: string; phone: string; fullName?: string }>('/auth/profile'),
    update: (data: { fullName?: string; username?: string; email?: string; phone?: string }) =>
        put<{ message: string }>('/auth/profile', data),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        put<{ message: string }>('/auth/profile', data),
};

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardResponse {
    totalClients: number;
    newCustomersThisMonth: number;
    activeSubscribers: number;
    expiredSubscribers: number;
    totalRevenue: number;
    todayRevenue: number;
    monthlyRevenue: number;
    todayRechargesMobile: number;
    monthlyRechargesMobile: number;
    todayVoucherRev: number;
    monthlyVoucherRev: number;
    vouchersGeneratedToday: number;
    vouchersUsedToday: number;
    vouchersGeneratedMonth: number;
    vouchersUsedMonth: number;
    todayRechargesVoucher: number;
    serviceUtilization: { id: string; name: string; type: string; activeUsersCount: number }[];
    mobileTransactions: { totalCount: number; totalRevenue: number; paid: number; unpaid: number; failed: number; canceled: number };
    revenueAnalytics: { daily: { name: string; value: number }[]; weekly: { name: string; value: number }[]; monthly: { name: string; value: number }[]; yearly: { name: string; value: number }[] };
    onlineUsers: number;
    hotspotOnlineUsers: number;
    pppoeOnlineUsers: number;
    totalRouters: number;
    onlineRouters: number;
    revenueChartData: { name: string; value: number }[];
    subscriberGrowthData: { month: string; clients: number }[];
    systemActivities: { id: string; title: string; description: string; date: string; type: string; status: string }[];
    recentTransactions: { id: string; user: string; amount: number; method: string; status: string; date: string; planType: string; timeActiveSys: string }[];
    recentSubscriptions: { id: string; username: string; plan: string; status: string; expiresAt: string }[];
}

export const dashboardApi = {
    getStats: (tenantId?: string, routerId?: string) => {
        const params = new URLSearchParams();
        if (tenantId) params.append('tenantId', tenantId);
        if (routerId && routerId !== 'All') params.append('routerId', routerId);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return get<DashboardResponse>(`/dashboard${qs}`);
    },
};

// ── Clients ─────────────────────────────────────────────────────────────────

export interface ClientListResponse {
    data: Array<{
        id: string; username: string; fullName: string; phone: string; email: string | null;
        serviceType: string; status: string; accountType: string; createdOn: string;
        plan?: string; router?: string; device?: string; macAddress?: string;
    }>;
    total: number; page: number; limit: number;
}

export const clientsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<ClientListResponse>(`/clients${qs}`);
    },
    get: (id: string) => get<Record<string, unknown>>(`/clients/${id}`),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/clients', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/clients/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/clients/${id}`),
};

// ── Packages ────────────────────────────────────────────────────────────────

export const packagesApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<Array<{
            id: string; name: string; type: string; category: string; bandwidth: string;
            uploadSpeed: number; uploadUnit: string; downloadSpeed: number; downloadUnit: string;
            price: number; router: string; validity: string; duration: number; durationUnit: string;
            status: string; burstEnabled: boolean; hotspotType: string; devices: number; paymentType: string;
        }>>(`/packages${qs}`);
    },
    get: (id: string) => get<Record<string, unknown>>(`/packages/${id}`),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/packages', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/packages/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/packages/${id}`),
};

// ── Subscriptions ───────────────────────────────────────────────────────────

export const subscriptionsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/subscriptions${qs}`);
    },
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/subscriptions', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/subscriptions/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/subscriptions/${id}`),
};

// ── Expired Subscribers ─────────────────────────────────────────────────────

export const expiredSubscribersApi = {
    list: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number; summaries: Record<string, unknown> }>(`/expired-subscribers${qs}`);
    },
    bulkExtend: (subscriptionIds: string[]) => {
        return post<{ message: string; successes: string[]; failures: Array<{ id: string; error: string }> }>('/expired-subscribers/bulk-extend', { subscriptionIds });
    },
};

// ── Active Subscribers ──────────────────────────────────────────────────────

export const activeSubscribersApi = {
    list: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number; summaries: Record<string, unknown> }>(`/active-subscribers${qs}`);
    },
};

// ── Transactions ────────────────────────────────────────────────────────────

export const licenseApi = {
    getLicense: () => get<LicenseResponse>('/license'),
    renewLicense: (data: { packageMonths: number; phoneNumber: string; amount: number; invoiceId?: string }) => post<{ success: boolean; message: string; expiresAt: string }>('/license/renew', data),
};

export const transactionsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/transactions${qs}`);
    },
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/transactions', data),
    delete: (id: string) => del<{ message: string }>(`/transactions/${id}`),
};

// ── Mobile Transactions ─────────────────────────────────────────────────────

export const mobileTransactionsApi = {
    list: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number; activeGateways: string[]; summaries: Record<string, unknown> }>(`/mobile-transactions${qs}`);
    },
};

// ── Routers ─────────────────────────────────────────────────────────────────

export const routersApi = {
    list: () => get<Array<{
        id: string; name: string; host: string; username: string; port: number; apiPort: number;
        type: string; vpnMode: string; description: string; status: string; activeUsers: number;
        cpuLoad: number; memoryUsed: number; uptime: string; lastSeen: string;
    }>>('/routers'),
    listPaginated: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/routers${qs}`);
    },
    get: (id: string) => get<Record<string, unknown>>(`/routers/${id}`),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/routers', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/routers/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/routers/${id}`),

    // Interfaces
    listInterfaces: (id: string) => get<any[]>(`/routers/${id}/interfaces`),

    // Test connection
    testConnection: (id: string) => post<{ success: boolean; message: string; info?: Record<string, unknown> }>(`/routers/${id}/test`, {}),

    // PPPoE
    pppoe: {
        list: (routerId: string) => get<Array<Record<string, unknown>>>(`/routers/${routerId}/pppoe`),
        create: (routerId: string, data: Record<string, unknown>) => post<Record<string, unknown>>(`/routers/${routerId}/pppoe`, data),
        update: (routerId: string, userId: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/routers/${routerId}/pppoe/${userId}`, data),
        delete: (routerId: string, userId: string) => del<Record<string, unknown>>(`/routers/${routerId}/pppoe/${userId}`),
    },

    // Hotspot
    hotspot: {
        list: (routerId: string) => get<Array<Record<string, unknown>>>(`/routers/${routerId}/hotspot`),
        create: (routerId: string, data: Record<string, unknown>) => post<Record<string, unknown>>(`/routers/${routerId}/hotspot`, data),
        update: (routerId: string, userId: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/routers/${routerId}/hotspot/${userId}`, data),
        delete: (routerId: string, userId: string) => del<Record<string, unknown>>(`/routers/${routerId}/hotspot/${userId}`),
    },

    // Sessions
    sessions: {
        list: (routerId: string) => get<Array<Record<string, unknown>>>(`/routers/${routerId}/sessions`),
        disconnect: (routerId: string, data: { sessionId: string; service: string; username?: string }) =>
            post<Record<string, unknown>>(`/routers/${routerId}/sessions/disconnect`, data),
    },

    // Profiles
    profiles: {
        list: (routerId: string, type?: string) => get<Record<string, unknown>>(`/routers/${routerId}/profiles${type ? `?type=${type}` : ''}`),
        create: (routerId: string, data: Record<string, unknown>) => post<Record<string, unknown>>(`/routers/${routerId}/profiles`, data),
    },

    // Logs
    logs: {
        list: (params?: Record<string, string>) => {
            const qs = params ? '?' + new URLSearchParams(params).toString() : '';
            return get<{ data: Array<Record<string, unknown>>; total: number }>(`/routers/logs${qs}`);
        },
    },

    // WireGuard
    wireguard: {
        getConfig: (routerId: string) => get<Record<string, unknown>>(`/routers/${routerId}/wireguard`),
        activate: (routerId: string) => post<Record<string, unknown>>(`/routers/${routerId}/wireguard`, { action: 'activate' }),
        deactivate: (routerId: string) => post<Record<string, unknown>>(`/routers/${routerId}/wireguard`, { action: 'deactivate' }),
        pushConfig: (routerId: string) => post<Record<string, unknown>>(`/routers/${routerId}/wireguard`, { action: 'push-config' }),
    },
};

// ── Equipment ───────────────────────────────────────────────────────────────

export const equipmentApi = {
    list: () => get<Array<Record<string, unknown>>>('/equipment'),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/equipment', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/equipment/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/equipment/${id}`),
};

// ── Vouchers ────────────────────────────────────────────────────────────────

export const vouchersApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/vouchers${qs}`);
    },
    generate: (data: Record<string, unknown>) => post<Record<string, unknown>>('/vouchers/generate', data),
    delete: (id: string) => del<{ message: string }>(`/vouchers/${id}`),
};

// ── SMS ─────────────────────────────────────────────────────────────────────

export const smsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/sms${qs}`);
    },
    send: (data: Record<string, unknown>) => post<Record<string, unknown>>('/sms', data),
    sendBulk: (data: Record<string, unknown>) => post<Record<string, unknown>>('/sms/bulk', data),
    templates: {
        list: () => get<Array<Record<string, unknown>>>('/sms/templates'),
        create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/sms/templates', data),
        update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/sms/templates/${id}`, data),
        delete: (id: string) => del<{ message: string }>(`/sms/templates/${id}`),
    },
};

// ── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
    list: () => get<Array<{
        id: string; username: string; email: string; role: string;
        status: string; lastLogin: string; phone: string;
    }>>('/users'),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/users', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/users/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/users/${id}`),
};

// ── Invoices ────────────────────────────────────────────────────────────────

export const invoicesApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/invoices${qs}`);
    },
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/invoices', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/invoices/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/invoices/${id}`),
};

// ── Expenses ────────────────────────────────────────────────────────────────

export const expensesApi = {
    list: () => get<Array<Record<string, unknown>>>('/expenses'),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/expenses', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/expenses/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/expenses/${id}`),
};

// ── Payment Channels ────────────────────────────────────────────────────────

export const paymentChannelsApi = {
    list: () => get<Array<Record<string, unknown>>>('/payment-channels'),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/payment-channels', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/payment-channels/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/payment-channels/${id}`),
};

// ── Settings ────────────────────────────────────────────────────────────────

export const settingsApi = {
    get: () => get<Record<string, string>>('/settings'),
    update: (data: Record<string, string>) => put<{ message: string }>('/settings', data),
};

// ── Hotspot Settings ────────────────────────────────────────────────────────

export interface HotspotSettings {
    id: string;
    routerId: string;
    primaryColor: string;
    accentColor: string;
    selectedFont: string;
    layout: string;
    enableAds: boolean;
    enableAnnouncement: boolean;
    enableRememberMe: boolean;
    companyName?: string;
    customerCareNumber?: string;
    adMessage?: string;
    backendUrl?: string;
}

export const hotspotSettingsApi = {
    get: (routerId: string) => get<HotspotSettings>(`/hotspot-settings?routerId=${routerId}`),
    update: (data: Partial<HotspotSettings> & { routerId: string }) => post<HotspotSettings>('/hotspot-settings', data),
};

// ── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
    get: (params: Record<string, string>) => {
        const qs = '?' + new URLSearchParams(params).toString();
        return get<Record<string, unknown>>(`/reports${qs}`);
    },
};

// ── VPN Management ──────────────────────────────────────────────────────────

export const vpnApi = {
    list: () => get<unknown[]>('/vpn'),
    create: (data: Record<string, unknown>) => post<unknown>('/vpn', data),
    delete: (id: string) => del<{ message: string }>(`/vpn/${id}`),
};

// ── Super Admin ─────────────────────────────────────────────────────────────

export const superAdminTenantsApi = {
    list: () => get<Array<any>>('/super-admin/tenants'),
    // Uses the dedicated /approve route which sends email notification
    approve: (tenantId: string) => post<any>('/super-admin/tenants/approve', { tenantId }),
    // Uses the main route for suspend/reactivate (no email needed)
    action: (tenantId: string, action: 'suspend' | 'reactivate') =>
        post<any>('/super-admin/tenants', { tenantId, action }),
};

export const adminInvoicesApi = {
    list: () => get<Array<any>>('/admin/saas-invoices'),
    confirmPayment: (invoiceId: string) =>
        post<any>('/admin/saas-invoices', { action: 'confirm_payment', invoiceId }),
    create: (data: { tenantId: string; planId: string; amount: number; dueDate?: string; packageMonths?: number }) =>
        post<any>('/admin/saas-invoices', { action: 'create', ...data }),
    // Extend a tenant's license by N months — auto-calculates new expiry from current date
    extend: (tenantId: string, months: number) =>
        post<any>('/admin/saas-invoices', { action: 'extend', tenantId, months }),
};
