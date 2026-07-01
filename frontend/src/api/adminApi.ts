// ── Admin & System API ────────────────────────────────────────────────────────
import { get, post, put, del } from './httpClient';

export const systemUsersApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/system-users'),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/system-users', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/system-users/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/system-users/${id}`),
};

export const systemSettingsApi = {
    get:    ()                              => get<Record<string, unknown>>('/system-settings'),
    update: (data: Record<string, unknown>) => put<Record<string, unknown>>('/system-settings', data),
};

export const voucherCodesApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<Record<string, unknown>>(`/vouchers${qs}`);
    },
    generate: (data: Record<string, unknown>) => post<Record<string, unknown>>('/vouchers/generate', data),
    delete: (id: string) => del<{ message: string }>(`/vouchers/${id}`),
};

export const settingsApi = {
    get: () => get<Record<string, string>>('/system-settings'),
    update: (data: Record<string, string>) => put<{ message: string }>('/system-settings', data),
};

/** Test a payment gateway API key/URL before saving. Returns { success, message, statusCode, baseUrl } */
export const paymentChannelTestApi = {
    test: (data: {
        provider: string;
        apiKey: string;
        apiUrl: string;
        apiSecret?: string;
    }) => post<{ success: boolean; message: string; statusCode: number; baseUrl: string; reachable: boolean }>(
        '/payment-channels/test-api',
        data
    ),
};

export interface DashboardResponse {
    todayRevenue: number;
    todayRevenueTrend?: number;
    monthlyRevenue: number;
    todayRechargesMobile: number;
    monthlyRechargesMobile: number;
    activeSubscribers: number;
    onlineUsers: number;
    totalClients: number;
    newCustomersThisMonth: number;
    todayVoucherRev: number;
    todayVoucherRevTrend?: number;
    vouchersUsedToday: number;
    vouchersGeneratedToday?: number;
    monthlyVoucherRev: number;
    vouchersUsedMonth: number;
    vouchersGeneratedMonth?: number;
    monthlyRevenueTrend?: number;
    monthlyVoucherRevTrend?: number;
    onlineRouters: number;
    totalRouters: number;
    hotspotOnlineUsers: number;
    pppoeOnlineUsers: number;
    todayRechargesVoucher: number;
    recentTransactions: Array<{
        user: string;
        date: string;
        planType: string;
        timeActiveSys: string;
        amount: number;
        method: string;
        isVoucher: boolean;
        transactionType: string;
        paymentChannel: string;
        status: string;
        reference?: string | null;
        transactionId?: string | null;
        providerRef?: string | null;
    }>;
    revenueAnalytics: Record<string, Array<{
        name: string;
        value: number;
    }>>;
    serviceUtilization: Array<{
        name: string;
        type: string;
        activeUsersCount: number;
    }>;
    systemActivities?: Array<{
        id: string;
        title: string;
        description: string;
        date: string;
        type: string;
        status: string;
    }>;
}

export const dashboardApi = {
    getStats: (tenantId?: string, routerId?: string) => {
        const params = new URLSearchParams();
        if (tenantId) params.append('tenantId', tenantId);
        if (routerId && routerId !== 'All') params.append('routerId', routerId);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return get<DashboardResponse>(`/dashboard${qs}`);
    }
};

export const superAdminTenantsApi = {
    list:           ()                                          => get<Record<string, unknown>[]>('/super-admin/tenants'),
    approve:        (tenantId: string)                          => post<{ message: string }>('/super-admin/tenants/approve', { tenantId, action: 'approve' }),
    reject:         (tenantId: string, reason?: string)         => post<{ message: string }>('/super-admin/tenants/approve', { tenantId, action: 'reject', reason }),
    suspend:        (tenantId: string)                          => post<{ message: string }>('/super-admin/tenants/approve', { tenantId, action: 'suspend' }),
    activate:       (tenantId: string)                          => post<{ message: string }>('/super-admin/tenants/approve', { tenantId, action: 'reactivate' }),
    getStats:       ()                                          => get<Record<string, unknown>>('/super-admin/stats'),
    updateLicense:  (tenantId: string, data: Record<string, unknown>) =>
        put<{ message: string }>(`/super-admin/tenants/${tenantId}/license`, data),
};

export const adminInvoicesApi = {
    list: () => get<Array<any>>('/admin/saas-invoices'),
    confirmPayment: (invoiceId: string) =>
        post<any>('/admin/saas-invoices', { action: 'confirm_payment', invoiceId }),
    create: (data: { tenantId: string; planId: string; amount: number; dueDate?: string; packageMonths?: number }) =>
        post<any>('/admin/saas-invoices', { action: 'create', ...data }),
    extend: (tenantId: string, months: number) =>
        post<any>('/admin/saas-invoices', { action: 'extend', tenantId, months }),
};
