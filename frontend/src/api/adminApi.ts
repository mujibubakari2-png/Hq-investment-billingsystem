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
    delete: (id: string) => del<{ message: string }>(`/vouchers/${id}`),
};

export const dashboardApi = {
    getStats: () => get<Record<string, unknown>>('/dashboard'),
};

export const superAdminTenantsApi = {
    list:           ()                                          => get<Record<string, unknown>[]>('/super-admin/tenants'),
    approve:        (tenantId: string)                          => post<{ message: string }>('/super-admin/tenants/approve', { tenantId }),
    reject:         (tenantId: string, reason?: string)         => post<{ message: string }>('/super-admin/tenants/reject', { tenantId, reason }),
    suspend:        (tenantId: string)                          => post<{ message: string }>('/super-admin/tenants/suspend', { tenantId }),
    activate:       (tenantId: string)                          => post<{ message: string }>('/super-admin/tenants/activate', { tenantId }),
    getStats:       ()                                          => get<Record<string, unknown>>('/super-admin/stats'),
    updateLicense:  (tenantId: string, data: Record<string, unknown>) =>
        put<{ message: string }>(`/super-admin/tenants/${tenantId}/license`, data),
};
