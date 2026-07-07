// ── Clients, Subscriptions, Packages API ─────────────────────────────────────
import { get, post, put, del } from './httpClient';
import type { Package } from '../types';

export interface ClientListItem {
    id: string; username: string; fullName: string; phone: string;
    email: string | null; serviceType: string; status: string;
    accountType: string; createdOn: string; plan?: string;
    router?: string; device?: string; macAddress?: string;
}
export interface ClientListResponse { data: ClientListItem[]; total: number; page: number; limit: number; }

export const clientsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<ClientListResponse>(`/clients${qs}`);
    },
    get:    (id: string)                               => get<Record<string, unknown>>(`/clients/${id}`),
    create: (data: Record<string, unknown>)            => post<Record<string, unknown>>('/clients', data),
    update: (id: string, data: Record<string, unknown>)=> put<Record<string, unknown>>(`/clients/${id}`, data),
    delete: (id: string)                               => del<{ message: string }>(`/clients/${id}`),
};

export interface PackageItem {
    id: string; name: string; type: string; category: string; bandwidth: string;
    uploadSpeed: number; uploadUnit: string; downloadSpeed: number; downloadUnit: string;
    price: number; router: string; validity: string; duration: number;
    durationUnit: string; status: string; burstEnabled: boolean;
    hotspotType: string; devices: number; paymentType: string;
}

export const packagesApi = {
    list: async (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        const response = await get<{ data: Package[]; total: number; page: number; limit: number }>(`/packages${qs}`);
        return response.data;
    },
    get:    (id: string)                                => get<Record<string, unknown>>(`/packages/${id}`),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/packages', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/packages/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/packages/${id}`),
};

export const subscriptionsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number }>(`/subscriptions${qs}`);
    },
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/subscriptions', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/subscriptions/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/subscriptions/${id}`),
};

export const activeSubscribersApi = {
    list: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number; summaries: Record<string, unknown> }>(`/active-subscribers${qs}`);
    },
};

export const expiredSubscribersApi = {
    list: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number; summaries: Record<string, unknown> }>(`/expired-subscribers${qs}`);
    },
    bulkExtend: (subscriptionIds: string[]) =>
        post<{ message: string; successes: string[]; failures: { id: string; error: string }[] }>(
            '/expired-subscribers/bulk-extend', { subscriptionIds }
        ),
};
