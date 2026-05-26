// ── Network (Routers, VPN, Equipments) API ───────────────────────────────────
import { get, post, put, del } from './httpClient';

export const routersApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/routers'),
    get:    (id: string)                                => get<Record<string, unknown>>(`/routers/${id}`),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/routers', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/routers/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/routers/${id}`),

    // Connection & session management
    testConnection:     (id: string)                                      => post<Record<string, unknown>>(`/routers/${id}/test-connection`, {}),
    getActiveSessions:  (id: string)                                      => get<Record<string, unknown>[]>(`/routers/${id}/active-sessions`),
    disconnectSession:  (id: string, data: { sessionId: string; service: string }) => post<{ message: string }>(`/routers/${id}/disconnect-session`, data),
    getSystemInfo:      (id: string)                                      => get<Record<string, unknown>>(`/routers/${id}/system-info`),
    getLogs:            (id: string, params?: Record<string, string>)     => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<Record<string, unknown>[]>(`/routers/${id}/logs${qs}`);
    },

    // PPPoE / Hotspot user management
    getPPPoEUsers:       (id: string)                                          => get<Record<string, unknown>[]>(`/routers/${id}/pppoe-users`),
    createPPPoEUser:     (id: string, data: Record<string, unknown>)           => post<Record<string, unknown>>(`/routers/${id}/pppoe-users`, data),
    getHotspotUsers:     (id: string)                                          => get<Record<string, unknown>[]>(`/routers/${id}/hotspot-users`),
    createHotspotUser:   (id: string, data: Record<string, unknown>)           => post<Record<string, unknown>>(`/routers/${id}/hotspot-users`, data),
    getBandwidthProfiles:(id: string, serviceType: 'pppoe' | 'hotspot')        => get<Record<string, unknown>[]>(`/routers/${id}/bandwidth-profiles?serviceType=${serviceType}`),
    createProfile:       (id: string, data: Record<string, unknown>)           => post<Record<string, unknown>>(`/routers/${id}/bandwidth-profiles`, data),

    // WireGuard VPN
    getWireguardConfig: (id: string)                                      => get<Record<string, unknown>>(`/routers/${id}/wireguard-config`),
    pushWireguardConfig:(id: string, data: Record<string, unknown>)       => post<Record<string, unknown>>(`/routers/${id}/push-wireguard`, data),

    // Hotspot portal customization
    getHotspotTemplate: (id: string)                                      => get<Record<string, unknown>>(`/routers/${id}/hotspot-template`),
    updateHotspotTemplate:(id: string, data: Record<string, unknown>)     => put<Record<string, unknown>>(`/routers/${id}/hotspot-template`, data),

    // Vouchers
    getVouchers:        (id: string, params?: Record<string, string>)     => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<Record<string, unknown>>(`/routers/${id}/vouchers${qs}`);
    },
    generateVouchers:   (id: string, data: Record<string, unknown>)       => post<Record<string, unknown>>(`/routers/${id}/vouchers/generate`, data),
};

export const vpnApi = {
    getStatus:     ()                              => get<Record<string, unknown>>('/vpn/status'),
    getConfig:     ()                              => get<Record<string, unknown>>('/vpn/config'),
    addPeer:       (data: Record<string, unknown>) => post<Record<string, unknown>>('/vpn/peers', data),
    getPeers:      ()                              => get<Record<string, unknown>[]>('/vpn/peers'),
    deletePeer:    (publicKey: string)             => del<{ message: string }>(`/vpn/peers/${encodeURIComponent(publicKey)}`),
};

export const equipmentsApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/equipments'),
    get:    (id: string)                                => get<Record<string, unknown>>(`/equipments/${id}`),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/equipments', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/equipments/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/equipments/${id}`),
};
