export type ManagementContext = 'BACKEND_API' | 'ADMIN_BROWSER' | 'WINBOX_CLIENT' | 'WEBFIG_CLIENT';

export interface RouterTarget {
    host: string;
    port: number;
    protocol?: string;
    reachableFrom: 'INTERNET' | 'MANAGEMENT_VPN' | 'INTERNAL_BACKEND' | 'UNREACHABLE';
    transport: 'REST' | 'WEBFIG' | 'WINBOX' | 'WIREGUARD';
    requiresVpn: boolean;
    instructions: string | null;
}

interface RouterLike {
    host: string;
    apiPort?: number | null;
    port?: number | null;
    wgEnabled?: boolean | null;
    wgTunnelIp?: string | null;
    wanIp?: string | null;
}

/**
 * Validates if an IP looks like an RFC-1918 private address.
 */
function isPrivateIp(ip: string): boolean {
    return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
}

/**
 * Resolves the correct management target based on the requester's context.
 * Never exposes a private VPN IP as if it were publicly reachable.
 */
export function resolveRouterManagementTarget(router: RouterLike, context: ManagementContext): RouterTarget {
    const isVpnHost = isPrivateIp(router.host);
    const usesWg = router.wgEnabled === true;
    
    // Default ports based on context
    let targetPort = router.port || 80;
    if (context === 'BACKEND_API') targetPort = router.apiPort || router.port || 8728;
    if (context === 'WINBOX_CLIENT') targetPort = 8291;

    switch (context) {
        case 'BACKEND_API':
            // Backend can always reach the VPN IP natively.
            // Prefer the explicit tunnel IP if configured, fallback to host.
            const apiHost = usesWg && router.wgTunnelIp ? router.wgTunnelIp : router.host;
            return {
                host: apiHost,
                port: targetPort,
                protocol: targetPort === 8729 ? 'https' : 'http',
                reachableFrom: 'INTERNAL_BACKEND',
                transport: 'REST',
                requiresVpn: false, // Backend is already on the VPN
                instructions: null
            };

        case 'WEBFIG_CLIENT':
        case 'ADMIN_BROWSER':
            // Browsers cannot route to 10.x.x.x unless the admin is on the VPN.
            if (isVpnHost || usesWg) {
                return {
                    host: router.wgTunnelIp || router.host,
                    port: 80,
                    protocol: 'http',
                    reachableFrom: 'MANAGEMENT_VPN',
                    transport: 'WEBFIG',
                    requiresVpn: true,
                    instructions: `To access WebFig, you must be connected to the ISP Management VPN. Open http://${router.wgTunnelIp || router.host} in your browser.`
                };
            }
            // Publicly reachable router
            return {
                host: router.wanIp || router.host,
                port: targetPort,
                protocol: 'http',
                reachableFrom: 'INTERNET',
                transport: 'WEBFIG',
                requiresVpn: false,
                instructions: `WebFig is accessible directly at http://${router.wanIp || router.host}.`
            };

        case 'WINBOX_CLIENT':
            // WinBox cannot natively route to 10.x.x.x unless the admin is on the VPN.
            if (isVpnHost || usesWg) {
                return {
                    host: router.wgTunnelIp || router.host,
                    port: 8291,
                    reachableFrom: 'MANAGEMENT_VPN',
                    transport: 'WINBOX',
                    requiresVpn: true,
                    // No credentials in URL as per security requirement
                    instructions: `Connect to the Management VPN, then open WinBox at ${router.wgTunnelIp || router.host}:8291.`
                };
            }
            // Publicly reachable WinBox
            return {
                host: router.wanIp || router.host,
                port: 8291,
                reachableFrom: 'INTERNET',
                transport: 'WINBOX',
                requiresVpn: false,
                instructions: `Open WinBox and connect to ${router.wanIp || router.host}:8291.`
            };
            
        default:
            throw new Error(`Unsupported management context: ${context}`);
    }
}
