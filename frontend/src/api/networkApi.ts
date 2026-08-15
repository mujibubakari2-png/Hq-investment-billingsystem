// ── Network (Routers, VPN, Equipments) API ───────────────────────────────────
import { get, post, put, del, downloadFile, getTextFile } from './httpClient';
import type { Router } from '../types';

export interface WireGuardConfig {
    routerId: string;
    routerName: string;
    routerHost: string;
    enabled: boolean;
    configuredAt: string | null;
    routerPrivateKey: string;
    routerPublicKey: string;
    serverPublicKey: string;
    presharedKey: string;
    routerTunnelIp: string;
    serverTunnelIp: string;
    listenPort: number;
    serverEndpoint: string;
    serverPort: number;
    tunnelActive: boolean;
    lastHandshakeSeconds: number | null;
    tunnelStatusMessage: string;
}

function scriptPath(id: string, lanPorts?: string[]): string {
    const qs = lanPorts?.length
        ? `?selectedInterfaces=${encodeURIComponent(lanPorts.join(','))}`
        : '';
    return `/routers/${id}/script${qs}`;
}

export const routersApi = {
    list:   ()                                          => get<Router[]>('/routers'),
    listPaginated: (params?: Record<string, string | number>) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
        return get<{ data: Router[]; total: number }>(`/routers${qs}`);
    },
    get:    (id: string)                                => get<Record<string, unknown>>(`/routers/${id}`),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/routers', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/routers/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/routers/${id}`),

    // Connection & session management
    testConnection:     (id: string)                                      => post<Record<string, unknown>>(`/routers/${id}/test-connection`, {}),
    getActiveSessions:  (id: string)                                      => get<Record<string, unknown>[]>(`/routers/${id}/active-sessions`),
    disconnectSession:  (id: string, data: { sessionId: string; service: string }) => post<{ message: string }>(`/routers/${id}/disconnect-session`, data),
    verifyRouter:       (id: string)                                      => get<any>(`/routers/${id}/verify`),
    listInterfaces:     (id: string)                                      => get<any[]>(`/routers/${id}/interfaces`),
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
    wireguard: {
        getConfig: (id: string) => get<WireGuardConfig>(`/routers/${id}/wireguard`),
        activate: (id: string) => post<Record<string, unknown>>(`/routers/${id}/wireguard`, { action: 'activate' }),
        deactivate: (id: string) => post<Record<string, unknown>>(`/routers/${id}/wireguard`, { action: 'deactivate' }),
        pushConfig: (id: string, lanPorts?: string[]) => post<Record<string, unknown>>(`/routers/${id}/wireguard`, { action: 'push-config', lanPorts }),
        getJobStatus: (id: string, jobId: string) => get<{ status: string; message?: string; error?: string }>(`/routers/${id}/wireguard/job/${jobId}`),
    },

    // Hotspot portal customization
    getHotspotTemplate: (id: string)                                      => get<Record<string, unknown>>(`/routers/${id}/hotspot-template`),
    updateHotspotTemplate:(id: string, data: Record<string, unknown>)     => put<Record<string, unknown>>(`/routers/${id}/hotspot-template`, data),

    // Vouchers
    getVouchers:        (id: string, params?: Record<string, string>)     => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return get<Record<string, unknown>>(`/routers/${id}/vouchers${qs}`);
    },
    generateVouchers:   (id: string, data: Record<string, unknown>)       => post<Record<string, unknown>>(`/routers/${id}/vouchers/generate`, data),

    // Router setup script (.rsc) — generated and signed server-side; never
    // built in the browser, so credentials never need to reach client JS.
    getScript: (id: string, lanPorts?: string[]) =>
        getTextFile(scriptPath(id, lanPorts)),
    downloadScript: (id: string, routerName?: string, lanPorts?: string[]) =>
        downloadFile(scriptPath(id, lanPorts), routerName ? `setup-${routerName}.rsc` : undefined),

    // Direct remote access — WebFig (browser) and Winbox (desktop) via the
    // backend's credential-safe relay.
    remoteAccess: {
        // FORENSIC-FIX-008: Previously returned a static URL string pointing to a backend
        // HTML page that linked to http://{router.host}. After Auto-Push, router.host
        // becomes a WireGuard VPN IP (e.g. 10.0.0.200) that the admin browser cannot
        // route to — the iframe was silently blank with no user-facing explanation.
        //
        // Now calls the backend JSON endpoint which returns:
        //   { webfigUrl, browserReachable, accessNote, host, wgEnabled, wgTunnelIp }
        // RouterDetailModal.tsx renders an appropriate panel based on this metadata.
        webfigUrl: (id: string) =>
            get<{
                routerId: string;
                routerName: string;
                host: string;
                wgEnabled: boolean;
                wgTunnelIp: string | null;
                browserReachable: boolean;
                webfigUrl: string;
                protocol: string;
                accessNote: string;
            }>(`/routers/${id}/webfig`),

        openWinboxSession: (id: string, winboxPort?: number) =>
            post<{
                host: string;
                vpnHost: string | null;
                wanHost: string | null;
                port: number;
                browserReachable: boolean;
                hostIsVpnIp: boolean;
                expiresInSeconds: number;
                instructions: string;
            }>(
                `/routers/${id}/winbox-session`,
                winboxPort ? { winboxPort } : {}
            ),

        closeWinboxSession: (id: string, port: number) =>
            del<{ success: boolean }>(`/routers/${id}/winbox-session?port=${port}`),
    },
};

export interface VpnListResponse {
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
}

export const vpnApi = {
    list:          ()                              => get<VpnListResponse>('/vpn'),
    create:        (data: Record<string, unknown>) => post<Record<string, unknown>>('/vpn', data),
    delete:        (id: string)                    => del<{ message: string }>(`/vpn/${encodeURIComponent(id)}`),
    getStatus:     ()                              => get<Record<string, unknown>>('/vpn/status'),
    getConfig:     ()                              => get<Record<string, unknown>>('/vpn/config'),
    addPeer:       (data: Record<string, unknown>) => post<Record<string, unknown>>('/vpn', data),
    getPeers:      ()                              => get<Record<string, unknown>[]>('/vpn'),
    deletePeer:    (id: string)                    => del<{ message: string }>(`/vpn/${encodeURIComponent(id)}`),
};

export const equipmentsApi = {
    list:   ()                                          => get<Record<string, unknown>[]>('/equipments'),
    get:    (id: string)                                => get<Record<string, unknown>>(`/equipments/${id}`),
    create: (data: Record<string, unknown>)             => post<Record<string, unknown>>('/equipments', data),
    update: (id: string, data: Record<string, unknown>) => put<Record<string, unknown>>(`/equipments/${id}`, data),
    delete: (id: string)                                => del<{ message: string }>(`/equipments/${id}`),
};

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
    update: (data: Partial<HotspotSettings> & { routerId: string }) => post<{ settings: HotspotSettings; saved: boolean; synced?: boolean; syncError?: string; syncMessage?: string }>('/hotspot-settings', data),
};

export const radiusSyncApi = {
    syncOnline: () => post<{ success: boolean; message: string; summary: Record<string, number> }>('/radius/sync-online', {}),
    getOnlineStats: () => get<{ totalOnline: number; hotspotOnline: number; pppoeOnline: number; totalActiveSubscriptions: number; onlineUsernames: string[]; sessions: Record<string, unknown>[] }>('/radius/sync-online'),
    previewExpiredVouchers: () => get<{ count: number; subscriptions: { id: string; username: string; fullName: string; plan: string; expiresAt: string | null; method: string }[] }>('/radius/voucher-expire'),
    expireVouchers: () => post<{ success: boolean; message: string; processed: number; succeeded: number; failed: number }>('/radius/voucher-expire', {}),
};
