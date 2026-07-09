export interface WireGuardConfigTextParams {
    mode: 'server' | 'client';
    routerName: string;
    routerId: string;
    routerPrivateKey?: string;
    routerPublicKey?: string;
    serverPublicKey?: string;
    presharedKey?: string;
    routerTunnelIp?: string;
    serverTunnelIp?: string;
    listenPort?: number;
    serverEndpoint?: string;
    serverPort?: number;
    serverPrivateKey?: string;
}

function normalizeIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    return ip.split('/')[0];
}

export function buildWireGuardConfigText(params: WireGuardConfigTextParams): string {
    const routerPrivateKey = params.routerPrivateKey || '<ROUTER_PRIVATE_KEY>';
    const serverPrivateKey = params.serverPrivateKey || '<SERVER_PRIVATE_KEY>';
    const routerTunnelIp = normalizeIp(params.routerTunnelIp) || '10.0.0.200';
    const serverTunnelIp = normalizeIp(params.serverTunnelIp) || '10.0.0.1';
    const listenPort = params.listenPort || 51820;
    const serverEndpoint = params.serverEndpoint || 'vpn.example.com';
    const serverPort = params.serverPort || listenPort;
    const serverPublicKey = params.serverPublicKey || '<SERVER_PUBLIC_KEY>';
    const routerPublicKey = params.routerPublicKey || '<ROUTER_PUBLIC_KEY>';
    const presharedKey = params.presharedKey || '<PRESHARED_KEY>';

    if (params.mode === 'server') {
        return `# ═══════════════════════════════════════════════════════════════
# WireGuard Server Config (wg-quick style)
# For Router: ${params.routerName} (${params.routerId})
# ═══════════════════════════════════════════════════════════════

[Interface]
# The router's private key (kept on the device)
PrivateKey = ${routerPrivateKey}
Address = ${routerTunnelIp}/32
ListenPort = ${listenPort}
DNS = 8.8.8.8, 1.1.1.1

[Peer]
# ISP Server peer
PublicKey = ${serverPublicKey}
PresharedKey = ${presharedKey}
# Route the entire tunnel subnet through the ISP peer
AllowedIPs = ${serverTunnelIp.split('.').slice(0, 3).join('.')}.0/24
Endpoint = ${serverEndpoint}:${serverPort}
PersistentKeepalive = 25

# Note: This is WireGuard config only. Full MikroTik .rsc is available from the Router Setup Wizard → Generate → Create Config.`;
    }

    return `# ═══════════════════════════════════════════════════════════════
# WireGuard Client Config — HQInvestment ISP Server
# For Router: ${params.routerName} (${params.routerId})
# Keys are PERSISTENT — install this on the HQInvestment VPN server
# ═══════════════════════════════════════════════════════════════

[Interface]
# HQInvestment ISP Server side — server private key (KEEP SECRET)
PrivateKey = ${serverPrivateKey}
Address = ${serverTunnelIp}/32
DNS = 8.8.8.8, 1.1.1.1

[Peer]
# Router: ${params.routerName}
PublicKey = ${routerPublicKey}
PresharedKey = ${presharedKey}
# Route the tunnel subnet through the router peer
AllowedIPs = ${routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24
Endpoint = ${serverEndpoint}:${serverPort}
PersistentKeepalive = 25`;
}
