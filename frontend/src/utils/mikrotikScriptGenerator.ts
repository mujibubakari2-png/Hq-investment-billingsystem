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
}

export function generateMikrotikScript(params: MikrotikScriptParams): string {
    const {
        routerName, routerUsername, routerPassword, routerId, apiHost, publicApiBase,
        isWireGuard, listenPort, routerPrivateKey, serverPubKey, presharedKey,
        serverEndpoint, serverPort, routerTunnelIp, serverTunnelIp
    } = params;

    const sanitizeName = (name: string) => 
        name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    
    const safeRouterName = sanitizeName(routerName);
    const safeRouterNameLower = safeRouterName.toLowerCase();
    
    // subnetAddress: the VPN management subnet (used for firewall src-address restrictions)
    const subnetAddress = isWireGuard && routerTunnelIp ? `${routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24` : '';
    // serverSubnet: the server-side VPN subnet — WireGuard peer allowed-address should be this,
    // NOT the router's LAN subnet. Allowing 0.0.0.0/0 would route all client traffic through the VPN.
    const serverSubnet  = isWireGuard && serverTunnelIp ? `${serverTunnelIp.split('.').slice(0, 3).join('.')}.0/24` : (subnetAddress || '0.0.0.0/0');
    const radiusAddress = isWireGuard && serverTunnelIp ? serverTunnelIp : apiHost;

    // LAN gateway = router's VPN tunnel IP (REQUIRED — must be provided by caller)
    const lanGateway    = routerTunnelIp ?? '';
    const lanPrefix     = lanGateway.split('.').slice(0, 3).join('.');  // e.g. "10.0.0"
    const lanCidr       = lanGateway ? `${lanGateway}/24`  : '';        // e.g. "10.0.0.201/24"
    const lanNetwork    = lanPrefix  ? `${lanPrefix}.0/24` : '';        // e.g. "10.0.0.0/24"
    // Separate pools: Hotspot .10-.149 | PPPoE .150-.250 (prevents IP collision)
    const hsPoolStart   = lanPrefix  ? `${lanPrefix}.10`   : '';
    const hsPoolEnd     = lanPrefix  ? `${lanPrefix}.149`  : '';
    const ppoePoolStart = lanPrefix  ? `${lanPrefix}.150`  : '';
    const ppoePoolEnd   = lanPrefix  ? `${lanPrefix}.250`  : '';

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
        /interface bridge add name=$lanBridge protocol-mode=none stp=no comment="LAN Bridge - Hotspot & PPPoE"
    } else={
        # Disable STP on existing bridge to prevent client delays
        /interface bridge set [find name=$lanBridge] protocol-mode=none stp=no
    }
}

# ── 3. IP Address on Bridge (MUST come before Hotspot creation) ─
# RouterOS requires the hotspot-address to exist on the interface
# before /ip hotspot can be created. Set IP first.
:if ([:len [/ip address find address="${lanCidr}" interface=$lanBridge]] = 0) do={
    /ip address add address=${lanCidr} interface=$lanBridge comment="HQInvestment Hotspot LAN"
}

# ── 4. IP Pools ──────────────────────────────────────────────────
# Hotspot clients: .10-.149  |  PPPoE clients: .150-.250
# Separate ranges prevent IP collisions between the two services
:if ([:len [/ip pool find name="hs-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="hs-pool-${safeRouterName}" ranges=${hsPoolStart}-${hsPoolEnd}
}
:if ([:len [/ip pool find name="pppoe-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="pppoe-pool-${safeRouterName}" ranges=${ppoePoolStart}-${ppoePoolEnd}
}

# ── 5. DHCP Server (Hotspot clients only) ────────────────────────
# DHCP only serves from the hotspot pool (.10-.149).
# PPPoE clients get IPs via PPP negotiation, not DHCP.
:if ([:len [/ip dhcp-server network find address="${lanNetwork}"]] = 0) do={
    /ip dhcp-server network add address=${lanNetwork} gateway=${lanGateway} dns-server=8.8.8.8,1.1.1.1
}
:local existingDhcp [/ip dhcp-server find where interface=$lanBridge];
:if ([:len $existingDhcp] > 0) do={
    /ip dhcp-server set $existingDhcp name="dhcp-${safeRouterName}" address-pool="hs-pool-${safeRouterName}" lease-time=1h disabled=no
} else={
    /ip dhcp-server add name="dhcp-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" lease-time=1h disabled=no
}

# ── 6. Hotspot Server ────────────────────────────────────────────
# IMPORTANT: hotspot is created AFTER IP address is assigned.
# login-by does NOT include 'mac' — MAC-only login bypasses password auth.
# SECURITY: login-by does NOT include 'mac' — MAC-only login bypasses password/voucher auth!
# mac-cookie is kept for session continuity only (requires prior login to set the cookie).
:if ([:len [/ip hotspot profile find name="hsprof-${safeRouterNameLower}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${safeRouterNameLower}" hotspot-address=${lanGateway} dns-name="${safeRouterNameLower}.hotspot" html-directory=hotspot login-by=http-chap,http-pap,cookie http-cookie-lifetime=3d use-radius=yes
} else={
    /ip hotspot profile set [find name="hsprof-${safeRouterNameLower}"] login-by=http-chap,http-pap,cookie use-radius=yes
}
# Enforce use-radius=yes AND remove 'mac' from login-by on ALL hotspot profiles (in case old ones exist)
:foreach prof in=[/ip hotspot profile find] do={
    /ip hotspot profile set $prof use-radius=yes login-by=http-chap,http-pap,cookie
}
:if ([:len [/ip hotspot find name="hotspot-${safeRouterName}"]] = 0) do={
    :if ([:len [/ip hotspot find interface=$lanBridge]] = 0) do={
        /ip hotspot add name="hotspot-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" profile="hsprof-${safeRouterNameLower}" disabled=no
    } else={
        /ip hotspot set [find interface=$lanBridge] profile="hsprof-${safeRouterNameLower}"
    }
}

# ── 7. PPPoE Server ──────────────────────────────────────────────
# PPPoE runs on the SAME bridge but uses its own IP pool (.150-.250).
# one-session-per-host prevents a single MAC from opening multiple sessions.
:if ([:len [/ppp profile find name="pppoe-profile-${safeRouterName}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${safeRouterName}" local-address=${lanGateway} remote-address="pppoe-pool-${safeRouterName}" dns-server=8.8.8.8,1.1.1.1 use-encryption=yes
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
# Using 0.0.0.0/0 would route ALL client traffic through the VPN tunnel — breaking internet access.
# Using the LAN subnet would cause routing loops. Only the server's management subnet is needed.
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${serverPubKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-hq" public-key="${serverPubKey}" ${presharedKey ? `preshared-key="${presharedKey}" ` : ''}endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${serverSubnet} persistent-keepalive=25s comment="HQInvestment ISP Server"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${serverPubKey}"] endpoint-address=${serverEndpoint} endpoint-port=${serverPort} allowed-address=${serverSubnet} persistent-keepalive=25s
}
:if ([:len [/ip address find address="${routerTunnelIp}/24" interface="wg-hq"]] = 0) do={
    /ip address add address=${routerTunnelIp}/24 interface="wg-hq" comment="HQInvestment VPN Address"
}
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

:if ([:len [/ip firewall filter find where comment="Allow Winbox"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=8291 ${isWireGuard ? `src-address=${subnetAddress} ` : ''}action=accept comment="Allow Winbox"
}
:if ([:len [/ip firewall filter find where comment="Allow Web"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=80,443 ${isWireGuard ? `src-address=${subnetAddress} ` : ''}action=accept comment="Allow Web"
}
:if ([:len [/ip firewall filter find where comment="Allow API"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=tcp dst-port=8728,8729 ${isWireGuard ? `src-address=${subnetAddress} ` : ''}action=accept comment="Allow API"
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
# These rules are the #1 cause of unauthenticated internet access on misconfigured routers.
:foreach r in=[/ip firewall filter find where (comment="Allow LAN to WAN" or comment="Allow LAN-WAN" or comment="allow lan to wan" or comment~"bypass")] do={
    /ip firewall filter remove $r
}

/ip firewall filter remove [find comment="Dummy HQ Rule"]

# Block all other unsolicited WAN input (must be AFTER all accept rules above)
:if ([:len [/ip firewall filter find where comment="Drop WAN input - HQInvestment"]] = 0) do={
    /ip firewall filter add chain=input in-interface=$wanInterface action=drop comment="Drop WAN input - HQInvestment"
}

# SECURITY: Block unauthenticated LAN/bridge clients from bypassing Hotspot portal.
# The Hotspot engine intercepts HTTP and redirects to the login page for unauthenticated clients.
# However, non-HTTP traffic (DNS queries to external servers, direct IP access) must also be blocked.
# This forward drop rule ensures that ONLY traffic explicitly accepted above passes through.
:if ([:len [/ip firewall filter find where comment="Drop unauthenticated LAN forward - HQInvestment"]] = 0) do={
    /ip firewall filter add chain=forward in-interface=$lanBridge out-interface=$wanInterface action=drop comment="Drop unauthenticated LAN forward - HQInvestment"
}
# NOTE: Hotspot and PPPoE authenticated sessions create dynamic accept rules automatically in RouterOS.
# The hotspot engine adds entries to /ip firewall filter (dynamic) for authenticated users.
# PPPoE sessions create virtual ppp interfaces (all-ppp) which are allowed by the rule above.

# ── 8. RADIUS & Walled Garden ──────────────────────────────────
:if ([:len [/radius find address="${radiusAddress}"]] = 0) do={
    /radius add service=hotspot,ppp address="${radiusAddress}" secret="${routerPassword || 'hqinvestment_radius_secret'}" authentication-port=1812 accounting-port=1813 timeout=3s ${isWireGuard ? `src-address=${routerTunnelIp} ` : ''}comment="HQInvestment RADIUS"
} else={
    /radius set [find address="${radiusAddress}"] secret="${routerPassword || 'hqinvestment_radius_secret'}" service=hotspot,ppp ${isWireGuard ? `src-address=${routerTunnelIp} ` : ''}comment="HQInvestment RADIUS"
}
/radius incoming set accept=yes port=3799
/ppp aaa set use-radius=yes accounting=yes

# Walled Garden - allow billing portal (DNS-based and IP-based)
# DNS entry: unauthenticated clients can reach billing portal by hostname
:if ([:len [/ip hotspot walled-garden find dst-host="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal"
}
# IP entry: uses actual server IP so portal works even if DNS is not set up
:if ([:len [/ip hotspot walled-garden ip find dst-address="${radiusAddress}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${radiusAddress}" action=accept comment="Billing Portal IP"
}
# VPN subnet entry: RADIUS auth traffic must flow even before login
${subnetAddress ? `:if ([:len [/ip hotspot walled-garden ip find dst-address="${subnetAddress}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${subnetAddress}" action=accept comment="VPN Subnet - HQInvestment"
}` : ''}
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
