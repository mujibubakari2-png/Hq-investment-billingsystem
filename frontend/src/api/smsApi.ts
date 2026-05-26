// ── SMS & Communications API ──────────────────────────────────────────────────
import { get, post, put, del } from './httpClient';

export const smsApi = {
    list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<{ data: Record<string, unknown>[]; total: number }>(`/sms${qs}`);
    },
    send:         (data: Record<string, unknown>)             => post<Record<string, unknown>>('/sms/send', data),
    sendBulk:     (data: Record<string, unknown>)             => post<Record<string, unknown>>('/sms/bulk', data),
};

export const smsTemplatesApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/sms/templates'),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/sms/templates', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/sms/templates/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/sms/templates/${id}`),
};
