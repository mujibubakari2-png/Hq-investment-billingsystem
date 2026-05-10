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
    serverEndpoint?: string;
    serverPort?: number;
    routerTunnelIp?: string;
    serverTunnelIp?: string;
}

export function generateMikrotikScript(params: MikrotikScriptParams): string {
    const {
        routerName, routerUsername, routerPassword, routerId, apiHost, publicApiBase,
        isWireGuard, listenPort, routerPrivateKey, serverPubKey, serverEndpoint,
        serverPort, routerTunnelIp, serverTunnelIp
    } = params;

    const sanitizeName = (name: string) => 
        name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    
    const safeRouterName = sanitizeName(routerName);
    const safeRouterNameLower = safeRouterName.toLowerCase();
    
    const subnetAddress = isWireGuard && routerTunnelIp ? `${routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24` : '';
    const radiusAddress = isWireGuard && serverTunnelIp ? serverTunnelIp : apiHost;

    // LAN gateway = router's VPN tunnel IP (REQUIRED — must be provided by caller)
    const lanGateway   = routerTunnelIp ?? '';
    const lanPrefix    = lanGateway.split('.').slice(0, 3).join('.');  // e.g. "10.0.0"
    const lanCidr      = lanGateway ? `${lanGateway}/24`  : '';        // e.g. "10.0.0.201/24"
    const lanNetwork   = lanPrefix  ? `${lanPrefix}.0/24` : '';        // e.g. "10.0.0.0/24"
    const lanPoolStart = lanPrefix  ? `${lanPrefix}.10`   : '';
    const lanPoolEnd   = lanPrefix  ? `${lanPrefix}.254`  : '';

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
    :if ([:len [/user find name="${routerUsername || 'admin'}"]] > 0) do={
        /user set [find name="${routerUsername || 'admin'}"] password="${routerPassword || ''}"
    }
}
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes
/system ntp client set enabled=yes
:if ([:len [/system ntp client servers find where address="pool.ntp.org"]] = 0) do={ /system ntp client servers add address=pool.ntp.org }

# ── 2. Bridge Setup ─────────────────────────────────────────────
:local existingBridges [/interface bridge find];
:if ([:len $existingBridges] > 0) do={
    :set lanBridge [/interface bridge get ($existingBridges->0) name];
} else={
    :if ([:len [/interface bridge find name=$lanBridge]] = 0) do={
        /interface bridge add name=$lanBridge comment="LAN Bridge - Hotspot & PPPoE"
    }
}

# ── 3. IP Pools & LAN Address ───────────────────────────────────
:if ([:len [/ip address find address="${lanCidr}"]] = 0) do={
    /ip address add address=${lanCidr} interface=$lanBridge comment="HQInvestment Hotspot LAN"
}
:if ([:len [/ip pool find name="hs-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="hs-pool-${safeRouterName}" ranges=${lanPoolStart}-${lanPoolEnd}
}
:if ([:len [/ip pool find name="pppoe-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="pppoe-pool-${safeRouterName}" ranges=${lanPoolStart}-${lanPoolEnd}
}

# ── 4. DHCP Server & Hotspot Setup ─────────────────────────────
:if ([:len [/ip dhcp-server network find address="${lanNetwork}"]] = 0) do={
    /ip dhcp-server network add address=${lanNetwork} gateway=${lanGateway} dns-server=8.8.8.8,1.1.1.1
}
:local existingDhcp [/ip dhcp-server find where interface=$lanBridge];
:if ([:len $existingDhcp] > 0) do={
    /ip dhcp-server set $existingDhcp name="dhcp-${safeRouterName}" address-pool="hs-pool-${safeRouterName}" disabled=no
} else={
    /ip dhcp-server add name="dhcp-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" disabled=no
}

:if ([:len [/ip hotspot profile find name="hsprof-${safeRouterNameLower}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${safeRouterNameLower}" hotspot-address=${lanGateway} dns-name="${safeRouterNameLower}.hotspot" html-directory=hotspot login-by=http-chap,http-pap,cookie,mac http-cookie-lifetime=3d use-radius=yes
}
:if ([:len [/ip hotspot find name="hotspot-${safeRouterName}"]] = 0) do={
    :if ([:len [/ip hotspot find interface=$lanBridge]] = 0) do={
        /ip hotspot add name="hotspot-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" profile="hsprof-${safeRouterNameLower}" disabled=no
    } else={
        /ip hotspot set [find interface=$lanBridge] profile="hsprof-${safeRouterNameLower}"
    }
}

# ── 5. PPPoE Server Setup ─────────────────────────────────────
:if ([:len [/ppp profile find name="pppoe-profile-${safeRouterName}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${safeRouterName}" local-address=${lanGateway} remote-address="pppoe-pool-${safeRouterName}" dns-server=8.8.8.8,1.1.1.1 use-encryption=yes
}
:if ([:len [/interface pppoe-server server find service-name="pppoe-svc-${safeRouterName}"]] = 0) do={
    /interface pppoe-server server add service-name="pppoe-svc-${safeRouterName}" interface=$lanBridge default-profile="pppoe-profile-${safeRouterName}" disabled=no
}

${isWireGuard ? `# ── 6. WireGuard VPN Configuration ─────────────────────────────
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name="wg-hq" listen-port=${listenPort} private-key="${routerPrivateKey}" comment="HQInvestment VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] listen-port=${listenPort} private-key="${routerPrivateKey}"
}
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${serverPubKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-hq" public-key="${serverPubKey}" endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=0.0.0.0/0 persistent-keepalive=25s comment="HQInvestment ISP Server"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${serverPubKey}"] endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=0.0.0.0/0 persistent-keepalive=25s
}
:if ([:len [/ip address find address="${routerTunnelIp}/24" interface="wg-hq"]] = 0) do={
    /ip address add address=${routerTunnelIp}/24 interface="wg-hq" comment="HQInvestment VPN Address"
}
` : ''}
# ── 7. Firewall & NAT ────────────────────────────────────────
:if ([:len [/ip firewall nat find action=masquerade chain=srcnat out-interface=$wanInterface]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=$wanInterface action=masquerade comment="Masquerade for internet"
}

# Firewall rules - placed at TOP to run before any drop rules
# We add a dummy rule first to ensure place-before=0 never fails on an empty firewall
:if ([:len [/ip firewall filter find comment="Dummy HQ Rule"]] = 0) do={
    /ip firewall filter add chain=input action=passthrough comment="Dummy HQ Rule"
}

:if ([:len [/ip firewall filter find where comment="Allow Winbox"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=8291 action=accept comment="Allow Winbox"
}
:if ([:len [/ip firewall filter find where comment="Allow Web"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=80,443 action=accept comment="Allow Web"
}
:if ([:len [/ip firewall filter find where comment="Allow API"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=8728,8729 action=accept comment="Allow API"
}
:if ([:len [/ip firewall filter find where comment="Allow DNS & DHCP"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=udp dst-port=53,67 action=accept comment="Allow DNS & DHCP"
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
:if ([:len [/ip firewall filter find where comment="Allow LAN to WAN"]] = 0) do={
    /ip firewall filter add place-before=0 chain=forward action=accept in-interface=$lanBridge out-interface=$wanInterface comment="Allow LAN to WAN"
}
:if ([:len [/ip firewall filter find where comment="Allow PPPoE to Internet"]] = 0) do={
    /ip firewall filter add place-before=0 chain=forward action=accept in-interface="all-ppp" out-interface=$wanInterface comment="Allow PPPoE to Internet"
}
:if ([:len [/ip firewall filter find where comment="Allow established forward"]] = 0) do={
    /ip firewall filter add place-before=0 chain=forward action=accept connection-state=established,related comment="Allow established forward"
}

/ip firewall filter remove [find comment="Dummy HQ Rule"]

# ── 8. RADIUS & Walled Garden ──────────────────────────────────
:if ([:len [/radius find address="${radiusAddress}"]] = 0) do={
    /radius add service=hotspot,ppp address="${radiusAddress}" secret="${routerPassword || 'hqinvestment_radius_secret'}" authentication-port=1812 accounting-port=1813 timeout=3s ${isWireGuard ? `src-address=${routerTunnelIp} ` : ''}comment="HQInvestment RADIUS"
} else={
    /radius set [find address="${radiusAddress}"] secret="${routerPassword || 'hqinvestment_radius_secret'}" service=hotspot,ppp ${isWireGuard ? `src-address=${routerTunnelIp} ` : ''}comment="HQInvestment RADIUS"
}
/radius incoming set accept=yes port=3799
/ppp aaa set use-radius=yes accounting=yes

# Walled Garden - allow billing portal (DNS-based and IP-based)
:if ([:len [/ip hotspot walled-garden find dst-host="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal"
}
:if ([:len [/ip hotspot walled-garden ip find dst-address="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${apiHost}" action=accept comment="Billing Portal IP"
}
# Management ports - idempotent
:if ([:len [/ip hotspot walled-garden ip find where comment="Allow Winbox Management"]] = 0) do={
    /ip hotspot walled-garden ip add action=accept dst-port=8291 protocol=tcp comment="Allow Winbox Management"
}
:if ([:len [/ip hotspot walled-garden ip find where comment="Allow API Management"]] = 0) do={
    /ip hotspot walled-garden ip add action=accept dst-port=8728-8729 protocol=tcp comment="Allow API Management"
}
:if ([:len [/ip hotspot walled-garden ip find where comment="Allow Web Management (HTTP)"]] = 0) do={
    /ip hotspot walled-garden ip add action=accept dst-port=80 protocol=tcp comment="Allow Web Management (HTTP)"
}
:if ([:len [/ip hotspot walled-garden ip find where comment="Allow Web Management (HTTPS)"]] = 0) do={
    /ip hotspot walled-garden ip add action=accept dst-port=443 protocol=tcp comment="Allow Web Management (HTTPS)"
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
