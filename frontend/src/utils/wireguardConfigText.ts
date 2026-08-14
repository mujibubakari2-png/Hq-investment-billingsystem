// ── WireGuard Configuration Text Builder ──────────────────────────────────────
//
// This module generates two distinct types of RouterOS (MikroTik) RSC snippet:
//
//   mode === 'server'  — The ROUTER's own WireGuard config.
//     The router is a CLIENT of the VPN server. Its peer entry points to the
//     server and uses:
//       allowed-address = SERVER_SUBNET/24   (e.g. 10.0.0.0/24)
//     This tells RouterOS to route all VPN-subnet traffic through the server peer.
//     The router's interface address uses /24 so RouterOS creates a connected
//     route for the VPN subnet via wg-hq (required for return traffic to work).
//
//   mode === 'client'  — A display/export snippet showing the SERVER's peer
//     entry for this specific router.
//     On the server (Linux wg0), each router peer must use:
//       AllowedIPs = ROUTER_IP/32   (e.g. 10.0.0.200/32)
//     This is a host route — the server only delivers packets addressed to the
//     exact router IP, never the whole subnet. Using /24 here would cause
//     overlapping allowed-ips across multiple routers, silently invalidating peers.
//
// ── Variable naming convention ────────────────────────────────────────────────
//
//   routerPeerAllowedAddress  — used in 'server' mode (router's peer → server)
//                               value: whole VPN subnet, e.g. "10.0.0.0/24"
//
//   serverPeerHostRoute       — used in 'client' mode (server's peer → router)
//                               value: exact router IP, e.g. "10.0.0.200/32"
//
// These two concepts are intentionally kept separate and must never be swapped.

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
}

function normalizeIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    return ip.split('/')[0];
}

export function buildWireGuardConfigText(params: WireGuardConfigTextParams): string {
    const routerPrivateKey = params.routerPrivateKey || '<ROUTER_PRIVATE_KEY>';
    const routerTunnelIp = normalizeIp(params.routerTunnelIp) || '10.0.0.200';
    const serverTunnelIp = normalizeIp(params.serverTunnelIp) || '10.0.0.1';
    const listenPort = params.listenPort || 51820;
    const serverEndpoint = params.serverEndpoint || 'vpn.example.com';
    const serverPort = params.serverPort || listenPort;
    const serverPublicKey = params.serverPublicKey || '<SERVER_PUBLIC_KEY>';
    const routerPublicKey = params.routerPublicKey || '<ROUTER_PUBLIC_KEY>';
    const presharedKey = params.presharedKey || '<PRESHARED_KEY>';

    // ── 'server' mode: router's config (router is a VPN client) ───────────────
    //
    // routerPeerAllowedAddress: what traffic the router should route through
    // the VPN server peer. Must be the whole VPN subnet (/24) so RouterOS
    // creates a connected route via wg-hq. Without this, return traffic from
    // the router exits via WAN and the server cannot reach the router.
    //
    const routerPeerAllowedAddress = `${serverTunnelIp.split('.').slice(0, 3).join('.')}.0/24`;

    // ── 'client' mode: server-side peer entry for this router ─────────────────
    //
    // serverPeerHostRoute: the server's view of this router — a /32 host route.
    // The server must only deliver packets to this specific router IP, never the
    // whole /24. Using /24 here causes overlapping allowed-ips when multiple
    // routers share the same VPN subnet (e.g. 10.0.0.0/24), silently invalidating
    // earlier peer registrations with no error output.
    //
    const serverPeerHostRoute = `${routerTunnelIp}/32`;

    if (params.mode === 'client') {
        return `# ═══════════════════════════════════════════════════════════════
# MikroTik RouterOS WireGuard config (ROUTER side)
# For Router: ${params.routerName} (${params.routerId})
# Paste into a RouterOS terminal or a .rsc script.
#
# Interface address: ${routerTunnelIp}/24
#   /24 is required so RouterOS installs a connected route for the VPN
#   subnet via wg-hq. Without it, the return path exits via WAN.
#
# Peer allowed-address: ${routerPeerAllowedAddress}
#   Routes all VPN-subnet traffic (10.0.0.0/24) through the server peer.
#   This is the ROUTER-SIDE setting and must remain /24.
# ═══════════════════════════════════════════════════════════════

/interface wireguard
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name="wg-hq" listen-port=${listenPort} private-key="${routerPrivateKey}" comment="HQ INVESTMENT VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] listen-port=${listenPort} private-key="${routerPrivateKey}"
}
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${serverPublicKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-hq" public-key="${serverPublicKey}" preshared-key="${presharedKey}" endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${routerPeerAllowedAddress} persistent-keepalive=25s comment="HQ INVESTMENT ISP Server"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${serverPublicKey}"] endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${routerPeerAllowedAddress} persistent-keepalive=25s
}
# Remove any stale address on wg-hq, then set /24 (required for subnet route)
:foreach addr in=[/ip address find interface="wg-hq"] do={ /ip address remove $addr }
/ip address add address=${routerTunnelIp}/24 interface="wg-hq" comment="HQ INVESTMENT VPN Address"

# Note: Full .rsc setup script available from Router Setup Wizard → Generate → Create Config.`;
    }

    // 'client' mode — shows server's peer entry for this router
    return `# ═══════════════════════════════════════════════════════════════
# WireGuard server-side peer entry for router: ${params.routerName}
# (${params.routerId})
#
# This shows what the VPN SERVER's wg0.conf peer stanza should look like.
# AllowedIPs uses /32 (host route) — one address per router peer.
# Using /24 here would cause multi-router subnet collisions.
#
# To apply on the server:
#   sudo wg set wg0 peer ${routerPublicKey} \\
#       allowed-ips ${serverPeerHostRoute}
#   sudo wg-quick save wg0
# ═══════════════════════════════════════════════════════════════

# Server wg0 interface (already configured via setup-vpn.sh):
#   Address = ${serverTunnelIp}/24
#   ListenPort = ${listenPort}

# Peer entry for this router (AllowedIPs = /32 host route):
[Peer]
PublicKey = ${routerPublicKey}
PresharedKey = ${presharedKey}
AllowedIPs = ${serverPeerHostRoute}
# No endpoint or keepalive needed on the server side (server is always reachable)
`;
}
