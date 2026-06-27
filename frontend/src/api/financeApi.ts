// ── Finance & Payments API ────────────────────────────────────────────────────
import { get, post, put, del } from './httpClient';

export const transactionsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number }>(`/transactions${qs}`);
    },
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>('/transactions', data),
    delete: (id: string)                    => del<{ message: string }>(`/transactions/${id}`),
};

export const mobileTransactionsApi = {
    list: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number; activeGateways: string[]; summaries: Record<string, unknown> }>(`/mobile-transactions${qs}`);
    },
};

export const expensesApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/expenses'),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/expenses', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/expenses/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/expenses/${id}`),
};

export const invoicesApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number }>(`/invoices${qs}`);
    },
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/invoices', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/invoices/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/invoices/${id}`),
};

export const paymentChannelsApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/payment-channels'),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/payment-channels', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/payment-channels/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/payment-channels/${id}`),
};

export interface LicenseResponse {
    isSuperAdmin: boolean;
    platformName?: string;
    platformPhone?: string;
    companyName?: string; companyLogo?: string;
    status?: string; daysRemaining?: number; expiresAt?: string;
    customersCount?: number; pppoeLimit?: number; hotspotLimit?: number | null; maxRouters?: number; paidThisMonth?: number;
    hasOutstanding?: boolean; message?: string;
    plan?: { id: string; name: string; price: number };
    outstandingInvoices?: { id: string; invoiceNumber: string; amount: number; dueDate: string; status: string }[];
    pendingInvoices?: { id: string; invoiceNumber: string; amount: number; dueDate: string; status: string }[];
}

export const licenseApi = {
    getLicense:  ()                                                                         => get<LicenseResponse>(`/license?_t=${Date.now()}`),
    renewLicense:(data: { packageMonths: number; phoneNumber: string; amount: number; invoiceId?: string }) =>
        post<{ success: boolean; message: string; expiresAt: string }>('/license/renew', data),
    changePlan:  (planId: string) =>
        post<{ message: string; plan: { id: string; name: string; price: number; pppoeLimit: number; hotspotLimit: number | null; maxRouters: number } }>('/license/change-plan', { planId }),
};

export interface SaasPlan { id: string; name: string; price: number; pppoeLimit: number; hotspotLimit: number | null; maxRouters: number; }
export const saasPlansApi = { list: () => get<SaasPlan[]>('/saas-plans') };

export const reportsApi = {
    get: (params: Record<string, string>) => {
        const qs = '?' + new URLSearchParams(params).toString();
        return get<Record<string, unknown>>(`/reports${qs}`);
    },
};
