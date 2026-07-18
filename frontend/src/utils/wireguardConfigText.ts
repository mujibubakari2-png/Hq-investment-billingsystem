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
    const serverPeerSubnet = `${serverTunnelIp.split('.').slice(0, 3).join('.')}.0/24`;
    // NOTE: AllowedIPs on the peer entries remain /32 — that restricts which
    // inner-tunnel IPs each peer may send. It is the INTERFACE address that
    // must be /24 so RouterOS creates a connected subnet route via wg-hq.

    if (params.mode === 'server') {
        return `# ═══════════════════════════════════════════════════════════════
# MikroTik RouterOS WireGuard config
# For Router: ${params.routerName} (${params.routerId})
# Paste into a RouterOS terminal or a .rsc script.
# ═══════════════════════════════════════════════════════════════

/interface wireguard
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name="wg-hq" listen-port=${listenPort} private-key="${routerPrivateKey}" comment="HQ INVESTMENT VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] listen-port=${listenPort} private-key="${routerPrivateKey}"
}
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${serverPublicKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-hq" public-key="${serverPublicKey}" preshared-key="${presharedKey}" endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${serverPeerSubnet} persistent-keepalive=25s comment="HQ INVESTMENT ISP Server"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${serverPublicKey}"] endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${serverPeerSubnet} persistent-keepalive=25s
}
# Remove stale /32 if present (causes routing issues), then set /24
:foreach addr in=[/ip address find interface="wg-hq"] do={ /ip address remove $addr }
/ip address add address=${routerTunnelIp}/24 interface="wg-hq" comment="HQ INVESTMENT VPN Address"

# Note: This is RouterOS-native syntax for MikroTik. The full .rsc script is also available from the Router Setup Wizard → Generate → Create Config.`;
    }

    return `# ═══════════════════════════════════════════════════════════════
# MikroTik RouterOS WireGuard client config
# For Router: ${params.routerName} (${params.routerId})
# Paste into a RouterOS terminal or a .rsc script.
# ═══════════════════════════════════════════════════════════════

/interface wireguard
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name="wg-hq" listen-port=${listenPort} private-key="${serverPrivateKey}" comment="HQ INVESTMENT VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] listen-port=${listenPort} private-key="${serverPrivateKey}"
}
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${routerPublicKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-hq" public-key="${routerPublicKey}" preshared-key="${presharedKey}" endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${routerTunnelIp}/32 persistent-keepalive=25s comment="Router ${params.routerName}"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${routerPublicKey}"] endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${routerTunnelIp}/32 persistent-keepalive=25s
}
# Remove stale /32 if present (causes routing issues), then set /24
:foreach addr in=[/ip address find interface="wg-hq"] do={ /ip address remove $addr }
/ip address add address=${serverTunnelIp}/24 interface="wg-hq" comment="HQ INVESTMENT VPN Address"
}`;
}
