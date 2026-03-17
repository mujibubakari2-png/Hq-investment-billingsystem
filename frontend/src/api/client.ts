// ── Central API client for the ISP Billing System ──────────────────────────

const BASE = '/api';

function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
            ...(init?.headers as Record<string, string>),
        },
    });

    if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data as T;
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
    register: (data: any) =>
        post<{ message: string; token: string; user: any }>('/auth/register', data),

    // Forgot Password
    requestPasswordResetOtp: (data: { email: string }) =>
        post<{ message: string; otp: string }>('/auth/forgot-password/request-otp', data),
    resetPassword: (data: any) =>
        post<{ message: string }>('/auth/forgot-password/reset', data),
};

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardResponse {
    totalClients: number;
    activeSubscribers: number;
    expiredSubscribers: number;
    totalRevenue: number;
    monthlyRevenue: number;
    onlineUsers: number;
    totalRouters: number;
    onlineRouters: number;
    revenueChartData: { name: string; value: number }[];
    subscriberGrowthData: { month: string; clients: number }[];
    systemActivities: { id: string; title: string; description: string; date: string; type: string; status: string }[];
    recentTransactions: { id: string; user: string; amount: number; method: string; status: string; date: string }[];
    recentSubscriptions: { id: string; username: string; plan: string; status: string; expiresAt: string }[];
}

export const dashboardApi = {
    getStats: () => get<DashboardResponse>('/dashboard'),
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

// ── Transactions ────────────────────────────────────────────────────────────

export const transactionsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Array<Record<string, unknown>>; total: number }>(`/transactions${qs}`);
    },
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/transactions', data),
    delete: (id: string) => del<{ message: string }>(`/transactions/${id}`),
};

// ── Routers ─────────────────────────────────────────────────────────────────

export const routersApi = {
    list: () => get<Array<{
        id: string; name: string; host: string; username: string; port: number; apiPort: number;
        type: string; vpnMode: string; description: string; status: string; activeUsers: number;
        cpuLoad: number; memoryUsed: number; uptime: string; lastSeen: string;
    }>>('/routers'),
    get: (id: string) => get<Record<string, unknown>>(`/routers/${id}`),
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/routers', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/routers/${id}`, data),
    delete: (id: string) => del<{ message: string }>(`/routers/${id}`),

    // Test connection
    testConnection: (id: string) => post<{ success: boolean; message: string; info?: any }>(`/routers/${id}/test`, {}),

    // PPPoE
    pppoe: {
        list: (routerId: string) => get<Array<any>>(`/routers/${routerId}/pppoe`),
        create: (routerId: string, data: any) => post<any>(`/routers/${routerId}/pppoe`, data),
        update: (routerId: string, userId: string, data: any) => put<any>(`/routers/${routerId}/pppoe/${userId}`, data),
        delete: (routerId: string, userId: string) => del<any>(`/routers/${routerId}/pppoe/${userId}`),
    },

    // Hotspot
    hotspot: {
        list: (routerId: string) => get<Array<any>>(`/routers/${routerId}/hotspot`),
        create: (routerId: string, data: any) => post<any>(`/routers/${routerId}/hotspot`, data),
        update: (routerId: string, userId: string, data: any) => put<any>(`/routers/${routerId}/hotspot/${userId}`, data),
        delete: (routerId: string, userId: string) => del<any>(`/routers/${routerId}/hotspot/${userId}`),
    },

    // Sessions
    sessions: {
        list: (routerId: string) => get<Array<any>>(`/routers/${routerId}/sessions`),
        disconnect: (routerId: string, data: { sessionId: string; service: string; username?: string }) =>
            post<any>(`/routers/${routerId}/sessions/disconnect`, data),
    },

    // Profiles
    profiles: {
        list: (routerId: string, type?: string) => get<any>(`/routers/${routerId}/profiles${type ? `?type=${type}` : ''}`),
        create: (routerId: string, data: any) => post<any>(`/routers/${routerId}/profiles`, data),
    },

    // Logs
    logs: {
        list: (params?: Record<string, string>) => {
            const qs = params ? '?' + new URLSearchParams(params).toString() : '';
            return get<{ data: Array<any>; total: number }>(`/routers/logs${qs}`);
        },
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

export const hotspotSettingsApi = {
    get: (routerId: string) => get<any>(`/hotspot-settings?routerId=${routerId}`),
    update: (data: any) => post<any>('/hotspot-settings', data),
};

// ── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
    get: (params: Record<string, string>) => {
        const qs = '?' + new URLSearchParams(params).toString();
        return get<Record<string, unknown>>(`/reports${qs}`);
    },
};
