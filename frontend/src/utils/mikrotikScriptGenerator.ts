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
    // SECURITY FIX: previously hardcoded to a single static string
    // ('HQInvestmentWiFi2026!') shared across EVERY tenant/router generated
    // by this function — anyone who learned that string from one deployed
    // router could join the WiFi/LAN of every other tenant's network. Derive
    // a per-router value instead so a leak is scoped to one router only.
    // NOTE: this client-side generator is superseded by the server-side
    // /api/routers/[id]/script endpoint (see routersApi.downloadScript) —
    // prefer that endpoint for new code; this file is kept only for any
    // remaining callers (e.g. MikrotikScriptModal) pending consolidation.
    const wifiPassword = routerPassword && routerPassword.length >= 8
        ? routerPassword
        : `HQ-${sanitizeName(routerName)}-${routerId}`.slice(0, 32);

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

# ── 2. Interface Lists (LAN/WAN) ─────────────────────────────────
# FIX CAUSE #20: Interface lists must exist so firewall rules work correctly.
:if ([:len [/interface list find name="WAN"]] = 0) do={ /interface list add name="WAN" comment="HQInvestment WAN" }
:if ([:len [/interface list find name="LAN"]] = 0) do={ /interface list add name="LAN" comment="HQInvestment LAN" }
:if ([:len [/interface list member find where interface=$wanInterface list="WAN"]] = 0) do={ /interface list member add interface=$wanInterface list="WAN" }

# ── 3. Bridge Setup ──────────────────────────────────────────────
# FIX CAUSE #15: STP disabled (protocol-mode=none) = no 30-second port-up delay.
# FIX CAUSE #5:  ARP mode must be "enabled" so dynamic leases work (reply-only breaks DHCP).
# FIX CAUSE #13: VLAN filtering off — prevents untagged client traffic being dropped.
:local existingBridges [/interface bridge find];
:local foundLanBridge 0;
:if ([:len $existingBridges] > 0) do={
    :foreach b in=$existingBridges do={
        :local bName [/interface bridge get $b name];
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
        /interface bridge add name=$lanBridge protocol-mode=none arp=enabled vlan-filtering=no comment="LAN Bridge - HQInvestment"
    } else={
        /interface bridge set [find name=$lanBridge] protocol-mode=none arp=enabled vlan-filtering=no
    }
} else={
    # Patch existing bridge: ensure STP off, ARP enabled, VLAN filtering off
    /interface bridge set [find name=$lanBridge] protocol-mode=none arp=enabled vlan-filtering=no
}

# FIX CAUSE #4: Add LAN interfaces (ether2+) to bridge if not already members.
# Skips ether1 (WAN). Covers ether2–ether5.
:foreach ethIface in=[:toarray "ether2,ether3,ether4,ether5"] do={
    :if ([:len [/interface find name=$ethIface]] > 0) do={
        :if ([:len [/interface bridge port find where interface=$ethIface]] = 0) do={
            /interface bridge port add interface=$ethIface bridge=$lanBridge comment="HQInvestment LAN port"
        }
    }
}

# FIX CAUSE #4+#12+#16: Add wlan1/wlan2 to bridge with correct settings.
# bridge-mode=enabled is mandatory — client isolation breaks DHCP when disabled.
# edge=yes (portfast) prevents STP delay on wireless ports.
:if ([:len [/interface wireless find default-name="wlan1"]] > 0) do={
    /interface wireless set [find default-name="wlan1"] bridge-mode=enabled disabled=no
    :if ([:len [/interface bridge port find where interface="wlan1"]] = 0) do={
        /interface bridge port add interface=wlan1 bridge=$lanBridge edge=yes comment="HQInvestment WiFi"
    } else={
        /interface bridge port set [find interface="wlan1"] edge=yes
    }
}
:if ([:len [/interface wireless find default-name="wlan2"]] > 0) do={
    /interface wireless set [find default-name="wlan2"] bridge-mode=enabled disabled=no
    :if ([:len [/interface bridge port find where interface="wlan2"]] = 0) do={
        /interface bridge port add interface=wlan2 bridge=$lanBridge edge=yes comment="HQInvestment WiFi 5GHz"
    } else={
        /interface bridge port set [find interface="wlan2"] edge=yes
    }
}

# Register bridge in LAN interface list
:if ([:len [/interface list member find where interface=$lanBridge list="LAN"]] = 0) do={ /interface list member add interface=$lanBridge list="LAN" }

# ── 4. IP Address on Bridge (MUST come before Hotspot creation) ──
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

# ── 6. Wi-Fi Security (WPA2-PSK) ────────────────────────────────
# Prevent MikroTik from leaving WLAN interfaces open and avoid the
# "pre-shared key authentication not enabled, disable WPS" warning.
:if ([:len [/interface wireless security-profiles find name="hq-wifi-sec"]] = 0) do={
    /interface wireless security-profiles add name="hq-wifi-sec" mode=dynamic-keys authentication-types=wpa2-psk wpa2-pre-shared-key="${wifiPassword}"
} else={
    /interface wireless security-profiles set [find name="hq-wifi-sec"] mode=dynamic-keys authentication-types=wpa2-psk wpa2-pre-shared-key="${wifiPassword}"
}
:if ([:len [/interface wireless find default-name="wlan1"]] > 0) do={
    /interface wireless set [find default-name="wlan1"] security-profile="hq-wifi-sec"
}
:if ([:len [/interface wireless find default-name="wlan2"]] > 0) do={
    /interface wireless set [find default-name="wlan2"] security-profile="hq-wifi-sec"
}

# ── 7. Hotspot Server ────────────────────────────────────────────
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

# ── 8. PPPoE Server ──────────────────────────────────────────────
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

${isWireGuard ? `# ── 9. WireGuard VPN Configuration ─────────────────────────────
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
# ── 10. Firewall & NAT ───────────────────────────────────────────
:if ([:len [/ip firewall nat find action=masquerade chain=srcnat out-interface=$wanInterface]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=$wanInterface action=masquerade comment="Masquerade for internet"
}

# FIX CAUSE #18: MSS Clamping — prevents large packets being dropped on PPPoE/WAN links.
# Essential for HTTPS and large downloads to work correctly.
:if ([:len [/ip firewall mangle find where comment="MSS Clamp - HQInvestment"]] = 0) do={
    /ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="MSS Clamp - HQInvestment"
}

# Firewall rules - placed at TOP to run before any drop rules
# We add a dummy rule first to ensure place-before=0 never fails on an empty firewall
:if ([:len [/ip firewall filter find comment="Dummy HQ Rule"]] = 0) do={
    /ip firewall filter add chain=input action=passthrough comment="Dummy HQ Rule"
}

# FIX CAUSE #3+#8: DHCP accept rule must be first — before ANY drop or FastTrack rules.
# Without this, a drop rule or FastTrack can silently discard DHCP DISCOVER/REQUEST
# packets and clients never receive an IP address.
:if ([:len [/ip firewall filter find where comment="Allow DHCP input - HQInvestment"]] = 0) do={
    /ip firewall filter add place-before=0 chain=input protocol=udp dst-port=67,68 action=accept comment="Allow DHCP input - HQInvestment"
}
:if ([:len [/ip firewall filter find where comment="Allow DHCP forward - HQInvestment"]] = 0) do={
    /ip firewall filter add place-before=0 chain=forward protocol=udp dst-port=67,68 action=accept comment="Allow DHCP forward - HQInvestment"
}

# SECURITY: Allow Winbox, Web, and API accept rules restricted to VPN subnet
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
    /ip firewall filter add place-before=0 chain=input in-interface-list=LAN protocol=udp dst-port=53,67 action=accept comment="Allow DNS & DHCP"
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

# Walled Garden - allow billing portal and the hotspot gateway itself so clients can reach the login page before full internet access is allowed.
:if ([:len [/ip hotspot walled-garden find dst-host="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal"
}
:if ([:len [/ip hotspot walled-garden ip find dst-address="${lanGateway}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${lanGateway}" action=accept comment="Hotspot Gateway"
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
# FIX CAUSE #19: Enable logging for all relevant topics.
# These logs are critical for diagnosing DHCP, wireless, hotspot, and firewall issues.
:if ([:len [/system logging find topics=hotspot]] = 0) do={ /system logging add topics=hotspot action=memory }
:if ([:len [/system logging find topics=radius]] = 0) do={ /system logging add topics=radius action=memory }
:if ([:len [/system logging find topics=pppoe]] = 0) do={ /system logging add topics=pppoe action=memory }
:if ([:len [/system logging find topics=dhcp]] = 0) do={ /system logging add topics=dhcp action=memory }
:if ([:len [/system logging find topics=wireless]] = 0) do={ /system logging add topics=wireless action=memory }
:if ([:len [/system logging find topics=firewall]] = 0) do={ /system logging add topics=firewall action=memory }

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
