export interface MikrotikScriptParams {
    routerName: string;
    routerUsername?: string;
    routerPassword?: string;
    routerId: string;
    apiHost: string;
    publicApiBase: string;

    // WireGuard specific (optional)
    isWireGuard?: boolean;
    listenPort?: number;
    routerPrivateKey?: string;
    serverPubKey?: string;
    presharedKey?: string;
    serverEndpoint?: string;
    serverPort?: number;
    routerTunnelIp?: string;
    serverTunnelIp?: string;

    // LAN / Pool / DNS Configuration (Required)
    lanIp?: string;
    lanGateway?: string;
    hotspotPoolRange?: string;
    pppoePoolRange?: string;
    dns?: string;
    radiusSecret?: string;
}

export function generateMikrotikScript(params: MikrotikScriptParams): string {
    const {
        routerName, routerUsername, routerPassword, routerId, apiHost, publicApiBase,
        isWireGuard, listenPort, routerPrivateKey, serverPubKey, presharedKey,
        serverEndpoint, serverPort, routerTunnelIp, serverTunnelIp,
        lanIp, lanGateway, hotspotPoolRange, pppoePoolRange, dns, radiusSecret
    } = params;

    // Strict frontend validation layer (P0)
    if (!lanIp || !lanGateway || !hotspotPoolRange || !pppoePoolRange || !dns) {
        throw new Error("Missing required configuration fields for script generation. Please configure LAN, Gateway, Pool ranges, and DNS on this router first.");
    }

    const sanitizeName = (name: string) =>
        name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

    const safeRouterName = sanitizeName(routerName);
    const safeRouterNameLower = safeRouterName.toLowerCase();

    // subnetAddress: the VPN management subnet (used for firewall src-address restrictions)
    const subnetAddress = routerTunnelIp ? `${routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24` : '10.200.0.0/24';
    // serverSubnet: the server-side VPN subnet used for the peer's allowed-address
    const serverSubnet = isWireGuard && serverTunnelIp ? `${serverTunnelIp.split('.').slice(0, 3).join('.')}.0/24` : (subnetAddress || '0.0.0.0/0');
    const radiusAddress = isWireGuard && serverTunnelIp ? serverTunnelIp : apiHost;

    // LAN variables
    const cleanLanIp = lanIp.includes('/') ? lanIp.split('/')[0] : lanIp;
    const lanCidr = lanIp.includes('/') ? lanIp : `${cleanLanIp}/24`;
    const parts = cleanLanIp.split('.');
    const lanNetwork = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : '';

    const dnsServers = dns;
    const radSecret = radiusSecret || '';

    const script = `# ═══════════════════════════════════════════════════════════════
# HQINVESTMENT ISP Billing - MikroTik Auto-Configuration Script
# Router: ${routerName}
# ID: ${routerId}
${isWireGuard ? `# VPN IP: ${routerTunnelIp}\n` : ''}# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

:global lanBridge "bridge-lan";
:global wanInterface "ether1";

# ── 1. System Identity & User ────────────────────────────────────────
/system identity set name="${routerName}"
:if ([:len [/user find name="admin"]] > 0) do={
    /user set [find name="admin"] name="${routerUsername || 'admin'}" password="${routerPassword || ''}"
} else={
    :if ([:len [/user find name="${routerUsername || 'admin'}"]] = 0) do={
        /user add name="${routerUsername || 'admin'}" password="${routerPassword || ''}" group=full comment="HQInvestment Admin"
    } else={
        /user set [find name="${routerUsername || 'admin'}"] password="${routerPassword || ''}" group=full
    }
}
/ip dns set servers=${dnsServers} allow-remote-requests=yes
/system ntp client set enabled=yes
:if ([:len [/system ntp client servers find where address="pool.ntp.org"]] = 0) do={ /system ntp client servers add address=pool.ntp.org }

# ── 2. Bridge Setup ─────────────────────────────────────────────
# Use the first LAN bridge found, but skip bridges that look like WAN bridges.
# If no bridge exists, create bridge-lan with STP disabled.
# (STP disabled = no 30-second port-up delay for new clients)
:local existingBridges [/interface bridge find];
:local foundLanBridge 0;
:if ([:len $existingBridges] > 0) do={
    :foreach b in=$existingBridges do={
        :local bName [/interface bridge get $b name];
        # Skip bridges named "wan" or "ether1" type names — use only LAN bridges
        :if ($bName != "wan-bridge" && $bName != "wan") do={
            :if ($foundLanBridge = 0) do={
                :set lanBridge $bName;
                :set foundLanBridge 1;
            }
        }
    }
}
:if ($foundLanBridge = 0) do={
    :if ([:len [/interface bridge find name=$lanBridge]] = 0) do={
        /interface bridge add name=$lanBridge protocol-mode=none comment="LAN Bridge - Hotspot & PPPoE"
    } else={
        # Disable STP on existing bridge to prevent client delays
        /interface bridge set [find name=$lanBridge] protocol-mode=none
    }
}

# ── 3. IP Address on Bridge (MUST come before Hotspot creation) ─
# RouterOS requires the hotspot-address to exist on the interface
# before /ip hotspot can be created. Set IP first.
:if ([:len [/ip address find address="${lanCidr}" interface=$lanBridge]] = 0) do={
    /ip address add address=${lanCidr} interface=$lanBridge comment="HQInvestment Hotspot LAN"
}

# ── 4. IP Pools ──────────────────────────────────────────────────
# Hotspot clients & PPPoE clients pools (configured from database to prevent conflicts)
:if ([:len [/ip pool find name="hs-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="hs-pool-${safeRouterName}" ranges=${hotspotPoolRange}
}
:if ([:len [/ip pool find name="pppoe-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="pppoe-pool-${safeRouterName}" ranges=${pppoePoolRange}
}

# ── 5. DHCP Server (Hotspot clients only) ────────────────────────
# DHCP only serves from the hotspot pool.
# PPPoE clients get IPs via PPP negotiation, not DHCP.
:if ([:len [/ip dhcp-server network find address="${lanNetwork}"]] = 0) do={
    /ip dhcp-server network add address=${lanNetwork} gateway=${lanGateway} dns-server=${dnsServers}
}
:local existingDhcp [/ip dhcp-server find where interface=$lanBridge];
:if ([:len $existingDhcp] > 0) do={
    /ip dhcp-server set $existingDhcp name="dhcp-${safeRouterName}" address-pool="hs-pool-${safeRouterName}" lease-time=1h disabled=no
} else={
    /ip dhcp-server add name="dhcp-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" lease-time=1h disabled=no
}

# ── 6. Hotspot Server ────────────────────────────────────────────
# IMPORTANT: hotspot is created AFTER IP address is assigned.
# login-by includes https and http-chap/http-pap, ssl-certificate=auto for Hotspot TLS/HTTPS
:if ([:len [/ip hotspot profile find name="hsprof-${safeRouterNameLower}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${safeRouterNameLower}" hotspot-address=${lanGateway} dns-name="${safeRouterNameLower}.hotspot" html-directory=hotspot login-by=http-chap,http-pap,https,cookie ssl-certificate=auto http-cookie-lifetime=3d use-radius=yes
} else={
    /ip hotspot profile set [find name="hsprof-${safeRouterNameLower}"] login-by=http-chap,http-pap,https,cookie ssl-certificate=auto use-radius=yes
}
# Enforce use-radius=yes AND configure SSL on ALL hotspot profiles (in case old ones exist)
:foreach prof in=[/ip hotspot profile find] do={
    /ip hotspot profile set $prof use-radius=yes login-by=http-chap,http-pap,https,cookie ssl-certificate=auto
}
:if ([:len [/ip hotspot find name="hotspot-${safeRouterName}"]] = 0) do={
    :if ([:len [/ip hotspot find interface=$lanBridge]] = 0) do={
        /ip hotspot add name="hotspot-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" profile="hsprof-${safeRouterNameLower}" disabled=no
    } else={
        /ip hotspot set [find interface=$lanBridge] profile="hsprof-${safeRouterNameLower}"
    }
}

# ── 7. PPPoE Server ──────────────────────────────────────────────
# PPPoE runs on the SAME bridge but uses its own IP pool.
# one-session-per-host prevents a single MAC from opening multiple sessions.
:if ([:len [/ppp profile find name="pppoe-profile-${safeRouterName}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${safeRouterName}" local-address=${lanGateway} remote-address="pppoe-pool-${safeRouterName}" dns-server=${dnsServers} use-encryption=yes
}
:if ([:len [/interface pppoe-server server find service-name="pppoe-svc-${safeRouterName}"]] = 0) do={
    /interface pppoe-server server add service-name="pppoe-svc-${safeRouterName}" interface=$lanBridge default-profile="pppoe-profile-${safeRouterName}" authentication=pap,chap,mschap1,mschap2 one-session-per-host=yes disabled=no
} else={
    /interface pppoe-server server set [find service-name="pppoe-svc-${safeRouterName}"] one-session-per-host=yes authentication=pap,chap,mschap1,mschap2
}

${isWireGuard ? `# ── 8. WireGuard VPN Configuration ─────────────────────────────
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name="wg-hq" listen-port=${listenPort} private-key="${routerPrivateKey}" comment="HQInvestment VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] listen-port=${listenPort} private-key="${routerPrivateKey}"
}
# SECURITY: allowed-address = server VPN subnet ONLY (not 0.0.0.0/0 and not the router's LAN subnet).
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${serverPubKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-hq" public-key="${serverPubKey}" ${presharedKey ? `preshared-key="${presharedKey}" ` : ''}endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${serverSubnet} persistent-keepalive=25s comment="HQInvestment ISP Server"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${serverPubKey}"] endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${serverSubnet} persistent-keepalive=25s
}
# /24 required so RouterOS creates a connected 10.0.0.0/24 route via wg-hq.
# Without this, ICMP/TCP replies from the router exit via WAN and are lost.
:foreach addr in=[/ip address find interface="wg-hq"] do={ /ip address remove $addr }
/ip address add address=${routerTunnelIp}/24 interface="wg-hq" comment="HQInvestment VPN Address"
` : ''}
# ── 9. Firewall & NAT ────────────────────────────────────────────
:if ([:len [/ip firewall nat find action=masquerade chain=srcnat out-interface=$wanInterface]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=$wanInterface action=masquerade comment="Masquerade for internet"
}

# Firewall rules - placed at TOP to run before any drop rules
# We add a dummy rule first to ensure place-before=0 never fails on an empty firewall
:if ([:len [/ip firewall filter find comment="Dummy HQ Rule"]] = 0) do={
    /ip firewall filter add chain=input action=passthrough comment="Dummy HQ Rule"
}

# SECURITY: Allow Winbox, Web, and API accept rules are restricted strictly to subnetAddress (TATIZO 2 fix)
:if ([:len [/ip firewall filter find where comment="Allow Winbox"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=8291 src-address=${subnetAddress} action=accept comment="Allow Winbox"
}
:if ([:len [/ip firewall filter find where comment="Allow Web"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=80,443 src-address=${subnetAddress} action=accept comment="Allow Web"
}
:if ([:len [/ip firewall filter find where comment="Allow API"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=8728,8729 src-address=${subnetAddress} action=accept comment="Allow API"
}
:if ([:len [/ip firewall filter find where comment="Allow DNS & DHCP"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input in-interface=$lanBridge protocol=udp dst-port=53,67 action=accept comment="Allow DNS & DHCP"
}
:if ([:len [/ip firewall filter find where comment="Allow Ping"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=icmp action=accept comment="Allow Ping"
}
${isWireGuard ? `:if ([:len [/ip firewall filter find where comment="Allow WireGuard - HQInvestment"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input action=accept protocol=udp dst-port=${listenPort} comment="Allow WireGuard - HQInvestment"
}
:if ([:len [/ip firewall filter find where comment="Allow API/Winbox from VPN - HQInvestment"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input action=accept protocol=tcp dst-port=80,8291 src-address=${subnetAddress} comment="Allow API/Winbox from VPN - HQInvestment"
}
:if ([:len [/ip firewall filter find where comment="Allow RADIUS CoA from VPN - HQInvestment"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input action=accept protocol=udp dst-port=3799 src-address=${subnetAddress} comment="Allow RADIUS CoA from VPN - HQInvestment"
}` : ''}
:if ([:len [/ip firewall filter find where comment="Allow established input"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input connection-state=established,related action=accept comment="Allow established input"
}

:if ([:len [/ip firewall filter find where comment="Allow PPPoE to Internet"]] = 0) do={
    /ip firewall filter add place-before=0 chain=forward action=accept in-interface="all-ppp" out-interface=$wanInterface comment="Allow PPPoE to Internet"
}
:if ([:len [/ip firewall filter find where comment="Allow established forward"]] = 0) do={
    /ip firewall filter add place-before=0 chain=forward action=accept connection-state=established,related comment="Allow established forward"
}

# SECURITY: Remove any legacy "Allow LAN to WAN" or "Allow all forward" rules that bypass Hotspot auth.
:foreach r in=[/ip firewall filter find where (comment="Allow LAN to WAN" or comment="Allow LAN-WAN" or comment="allow lan to wan" or comment~"bypass")] do={
    /ip firewall filter remove $r
}

/ip firewall filter remove [find comment="Dummy HQ Rule"]

# Block all other unsolicited WAN input (must be AFTER all accept rules above)
:if ([:len [/ip firewall filter find where comment="Drop WAN input - HQInvestment"]] = 0) do={
    /ip firewall filter add chain=input in-interface=$wanInterface action=drop comment="Drop WAN input - HQInvestment"
}

# ── 8. RADIUS & Walled Garden ──────────────────────────────────
# Configure per-router/tenant RADIUS secret (TATIZO 3 RADIUS secret fix)
:if ([:len [/radius find address="${radiusAddress}"]] = 0) do={
    /radius add service=hotspot,ppp address="${radiusAddress}" secret="${radSecret}" authentication-port=1812 accounting-port=1813 timeout=3s ${routerTunnelIp ? `src-address=${routerTunnelIp} ` : ''}comment="HQInvestment RADIUS"
} else={
    /radius set [find address="${radiusAddress}"] secret="${radSecret}" service=hotspot,ppp ${routerTunnelIp ? `src-address=${routerTunnelIp} ` : ''}comment="HQInvestment RADIUS"
}
/radius incoming set accept=yes port=3799
/ppp aaa set use-radius=yes accounting=yes

# Walled Garden - allow billing portal (DNS-based and IP-based)
:if ([:len [/ip hotspot walled-garden find dst-host="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal"
}
:if ([:len [/ip hotspot walled-garden ip find dst-address="${radiusAddress}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${radiusAddress}" action=accept comment="Billing Portal IP"
}
${subnetAddress ? `:if ([:len [/ip hotspot walled-garden ip find dst-address="${subnetAddress}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${subnetAddress}" action=accept comment="VPN Subnet - HQInvestment"
}` : ''}

# ── CRITICAL: Drop unauthenticated LAN forward LAST (after walled-garden setup)
# This must come AFTER walled-garden rules so clients can reach the login portal!
:if ([:len [/ip firewall filter find where comment="Drop unauthenticated LAN forward - HQInvestment"]] = 0) do={
    /ip firewall filter add chain=forward in-interface=$lanBridge out-interface=$wanInterface action=drop comment="Drop unauthenticated LAN forward - HQInvestment"
}

# ── 9. System Scheduler (Auto-sync with HQInvestment) ────────
:if ([:len [/system scheduler find name="billing-sync"]] > 0) do={ /system scheduler remove [find name="billing-sync"] }
:local syncUrl "${publicApiBase}/api/sync/${routerId}"
:local syncScript "/tool fetch url=$syncUrl keep-result=no"
/system scheduler add name="billing-sync" interval=5m on-event=$syncScript start-time=00:00:00 comment="HQInvestment Auto-Sync"

# ── 10. Logging ──────────────────────────────────────────────
:if ([:len [/system logging find topics=hotspot]] = 0) do={ /system logging add topics=hotspot action=memory }
:if ([:len [/system logging find topics=radius]] = 0) do={ /system logging add topics=radius action=memory }
:if ([:len [/system logging find topics=pppoe]] = 0) do={ /system logging add topics=pppoe action=memory }

# ═══════════════════════════════════════════════════════════════
# ✅ Script Complete! Router "${routerName}" is configured.
# Both Hotspot & PPPoE servers are set up.
${isWireGuard ? `# ─────────────────────────────────────────────────────────────
# VPN Configuration Summary:
# - Router VPN IP  : ${routerTunnelIp}
# - Server VPN IP  : ${serverTunnelIp}   ← RADIUS address
# - Server Endpoint: ${serverEndpoint}:${serverPort}
# - Interface      : wg-hq
# - Listen Port    : ${listenPort}` : ''}
# ═══════════════════════════════════════════════════════════════`;

    return script;
}
