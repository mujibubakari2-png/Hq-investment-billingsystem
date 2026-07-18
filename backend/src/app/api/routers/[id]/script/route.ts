import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { decryptRouterFields, encrypt } from "@/lib/encryption";
import { generateRouterAdminPassword, generateRadiusSecret } from "@/lib/routerProvisioning";
import logger from "@/lib/logger";

/**
 * GET /api/routers/[id]/script
 * 
 * Generates a MikroTik RouterOS script that the user can copy and paste 
 * into their router terminal to automatically configure it for HQInvestment.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const routerRaw = await db.router.findUnique({ where: { id } });

        if (!routerRaw) return errorResponse("Router not found", 404);
        if (!canAccessTenant(userPayload, routerRaw.tenantId)) {
            return errorResponse("Unauthorized", 403);
        }

        // P0 Validation layer: Validate required LAN/Subnet/DNS fields
        const missingFields: string[] = [];
        if (!routerRaw.lanIp) missingFields.push("lanIp");
        if (!routerRaw.lanGateway) missingFields.push("lanGateway");
        if (!routerRaw.hotspotPoolRange) missingFields.push("hotspotPoolRange");
        if (!routerRaw.pppoePoolRange) missingFields.push("pppoePoolRange");
        if (!routerRaw.dns) missingFields.push("dns");

        if (missingFields.length > 0) {
            return errorResponse(`Kupitisha script kumeshindwa kwa sababu router haina taarifa zifuatazo: ${missingFields.join(", ")}`, 400);
        }

        // Auto-generate credentials if missing (P1 & P2)
        let needsUpdate = false;
        let updatedPassword = routerRaw.password;
        let updatedRadiusSecret = routerRaw.radiusSecret;
        let updatedUsername = routerRaw.username;

        if (!routerRaw.password) {
            updatedPassword = encrypt(generateRouterAdminPassword());
            needsUpdate = true;
        }
        if (!routerRaw.radiusSecret) {
            updatedRadiusSecret = encrypt(generateRadiusSecret());
            needsUpdate = true;
        }
        if (!routerRaw.username || routerRaw.username === "admin") {
            updatedUsername = `hq_admin_${routerRaw.id.substring(0, 8).toLowerCase()}`;
            needsUpdate = true;
        }

        if (needsUpdate) {
            await db.router.update({
                where: { id },
                data: {
                    password: updatedPassword,
                    radiusSecret: updatedRadiusSecret,
                    username: updatedUsername,
                }
            });
            // Update local object fields
            routerRaw.password = updatedPassword;
            routerRaw.radiusSecret = updatedRadiusSecret;
            routerRaw.username = updatedUsername;
        }

        const router = decryptRouterFields(routerRaw);

        const apiPort = router.apiPort || 80;
        const serverUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";

        const cleanName = router.name.trim().replace(/^-+|-+$/g, '');
        const hotspotProfileName = `hq-hotspot-${cleanName.toLowerCase()}`;
        const hotspotServerName = `hotspot-${cleanName.toLowerCase()}`;
        const hotspotPoolName = `hs-pool-${cleanName.toLowerCase()}`;
        const pppoePoolName = `pppoe-pool-${cleanName.toLowerCase()}`;
        const lanBridgeName = 'bridge-lan';

        // Resolve VPN Subnet and VPN IP based on actual WireGuard Tunnel IP to prevent multi-tenant conflicts
        const subnetPrefix = router.wgTunnelIp ? router.wgTunnelIp.split('.').slice(0, 3).join('.') : "10.200.0";
        const vpnSubnet = `${subnetPrefix}.0/24`;
        const vpnIp = `${subnetPrefix}.1`;
        // CoA src-address restriction: only restrict to VPN IP when WireGuard is FULLY configured.
        // wgTunnelIp has a schema default of "10.200.0.1" — using it unconditionally would create
        // a broken CoA rule on non-WireGuard routers (no real tunnel = no reachable VPN IP).
        const wgFullyConfigured = !!(router.wgPrivateKey && router.wgPeerPublicKey && router.wgTunnelIp);
        const coaVpnRestriction = wgFullyConfigured ? `src-address=${vpnIp}` : "";

        // Billing portal hostname, used for the Walled Garden rule so unauthenticated
        // hotspot clients can still reach the payment/voucher page before login.
        let walledGardenHost = "";
        try {
            if (serverUrl) walledGardenHost = new URL(serverUrl).hostname;
        } catch (e) {
            logger.warn('[Script] Failed to parse APP_URL for walled garden host', {
                error: e instanceof Error ? e.message : String(e),
            });
        }

        let script = `# HQInvestment ISP Billing System - Router Setup Script
# Generated for: ${cleanName}
# Date: ${new Date().toISOString()}
#
# ==============================================================================
# ⚠️ SECURITY WARNING: This script contains plaintext passwords and VPN keys!
# After pasting this script into your router, please DELETE this file from your 
# computer immediately to prevent credential theft.
#
# ⚠️ PASTE THIS VIA A LOCAL/CONSOLE CONNECTION (physical cable or existing
# trusted Winbox/terminal session) — NOT over an untrusted network. Once this
# script runs, remote management (Winbox/WebFig/REST API) is firewalled to the
# HQInvestment VPN subnet only. If WireGuard has not yet completed a handshake
# when you run this, you may temporarily lose remote access to this router
# until the VPN tunnel comes up — keep a local/console connection available.
# ==============================================================================

/log info "Starting HQInvestment Auto-Configuration..."

# 1. Set System Identity
/system identity set name="${cleanName}"

# 2. Enable REST API (WWW-SSL is preferred, WWW is fallback)
/ip service set www-ssl disabled=no port=443
/ip service set www disabled=no port=${apiPort}
/log info "REST API services enabled on port 443 and ${apiPort}"

# 3. Create Management User (TATIZO 4 fix: rename default admin account to unique username)
:if ([:len [/user find name="admin"]] > 0) do={
    /user set [find name="admin"] name="${router.username}" password="${router.password || ''}"
} else={
    :if ([:len [/user find name="${router.username}"]] = 0) do={
        /user add name="${router.username}" password="${router.password || ''}" group=full comment="hqinvestment Admin"
    } else={
        /user set [find name="${router.username}"] password="${router.password || ''}" group=full
    }
}

# 4. Restrict MAC-Winbox / neighbor discovery to LAN + VPN only (NOT WAN).
# SECURITY FIX: allowed-interface-list=all previously exposed MAC-Winbox/mac-telnet
# and MNDP neighbor discovery on ether1 (WAN), a well-known L2 attack vector that
# lets anyone on the same broadcast segment as the WAN uplink discover and attempt
# to log into the router bypassing the IP-layer firewall entirely.
:if ([:len [/interface list find name="hq-mgmt"]] = 0) do={
    /interface list add name="hq-mgmt" comment="HQInvestment management interfaces (LAN+VPN only)"
}
:if ([:len [/interface list member find list="hq-mgmt" interface="${lanBridgeName}"]] = 0) do={
    /interface list member add list="hq-mgmt" interface="${lanBridgeName}"
}
:if ([:len [/interface wireguard find name="wg-hq"]] > 0) do={
    :if ([:len [/interface list member find list="hq-mgmt" interface="wg-hq"]] = 0) do={
        /interface list member add list="hq-mgmt" interface="wg-hq"
    }
}
/tool mac-server set allowed-interface-list=hq-mgmt
/tool mac-server mac-winbox set allowed-interface-list=hq-mgmt
/ip neighbor discovery-settings set discover-interface-list=hq-mgmt

# 4b. WAN/LAN Interface Lists (required for out-interface-list=WAN/LAN in firewall/NAT rules)
# Without these, NAT and PPPoE firewall rules break on routers where WAN is not ether1.
:if ([:len [/interface list find name="WAN"]] = 0) do={
    /interface list add name="WAN" comment="HQInvestment WAN"
}
:if ([:len [/interface list find name="LAN"]] = 0) do={
    /interface list add name="LAN" comment="HQInvestment LAN"
}
:if ([:len [/interface list member find list="WAN" interface="ether1"]] = 0) do={
    /interface list member add list="WAN" interface="ether1" comment="HQInvestment WAN port"
}

# 5. DNS and NTP (Critical for handshakes)
/ip dns set servers=${router.dns} allow-remote-requests=yes
/system ntp client set enabled=yes
:if ([:len [/system ntp client servers find where address="pool.ntp.org"]] = 0) do={
    /system ntp client servers add address=pool.ntp.org
}
:if ([:len [/ip dns static find name="router.lan"]] = 0) do={
    /ip dns static add name=router.lan address=${router.lanGateway} comment="HQInvestment"
}

# 6. LAN Bridge, IP Address, Hotspot, and PPPoE Setup
:local lanBridge "${lanBridgeName}"
:if ([:len [/interface bridge find name=$lanBridge]] = 0) do={
    /interface bridge add name=$lanBridge protocol-mode=none comment="HQInvestment Hotspot LAN"
}
:if ([:len [/interface list member find list="LAN" interface=$lanBridge]] = 0) do={
    /interface list member add list="LAN" interface=$lanBridge comment="HQInvestment LAN bridge"
}
:if ([:len [/ip pool find name="${hotspotPoolName}"]] = 0) do={
    /ip pool add name="${hotspotPoolName}" ranges=${router.hotspotPoolRange}
}
:if ([:len [/ip pool find name="${pppoePoolName}"]] = 0) do={
    /ip pool add name="${pppoePoolName}" ranges=${router.pppoePoolRange}
}
:if ([:len [/ip address find where address="${router.lanIp}" interface=$lanBridge]] = 0) do={
    /ip address add address="${router.lanIp}" interface=$lanBridge comment="HQInvestment Hotspot LAN"
}

# 6a. DHCP Server (REQUIRED: without this, hotspot clients never receive an IP
# address from the router and can never reach the captive-portal login page.)
:if ([:len [/ip dhcp-server network find where address="${router.lanIp}"]] = 0) do={
    /ip dhcp-server network add address="${router.lanIp}" gateway="${router.lanGateway}" dns-server=${router.dns} comment="HQInvestment Hotspot Network"
} else={
    /ip dhcp-server network set [find where address="${router.lanIp}"] gateway="${router.lanGateway}" dns-server=${router.dns}
}
:if ([:len [/ip dhcp-server find name="dhcp-${cleanName.toLowerCase()}"]] = 0) do={
    /ip dhcp-server add name="dhcp-${cleanName.toLowerCase()}" interface=$lanBridge address-pool="${hotspotPoolName}" lease-time=1h disabled=no
} else={
    /ip dhcp-server set [find name="dhcp-${cleanName.toLowerCase()}"] interface=$lanBridge address-pool="${hotspotPoolName}" disabled=no
}

# SECURITY FIX: http-pap removed from login-by. PAP sends the password in
# CLEAR TEXT over the wire; combined with the rlogin.html fallback this used
# to allow plaintext credential capture on the LAN segment whenever the CHAP
# challenge/JS path failed. Only https (TLS-encrypted) and http-chap
# (challenge-hashed, password never transmitted) are accepted now.
:if ([:len [/ip hotspot profile find name="${hotspotProfileName}"]] = 0) do={
    /ip hotspot profile add name="${hotspotProfileName}" hotspot-address=${router.lanGateway} dns-name="${cleanName.toLowerCase()}.hotspot" html-directory=hotspot login-by=http-chap,https,cookie ssl-certificate=auto http-cookie-lifetime=3d use-radius=yes
} else={
    /ip hotspot profile set [find name="${hotspotProfileName}"] hotspot-address=${router.lanGateway} dns-name="${cleanName.toLowerCase()}.hotspot" login-by=http-chap,https,cookie ssl-certificate=auto use-radius=yes
}
:if ([:len [/ip hotspot find name="${hotspotServerName}"]] = 0) do={
    /ip hotspot add name="${hotspotServerName}" interface=$lanBridge address-pool="${hotspotPoolName}" profile="${hotspotProfileName}" disabled=no
} else={
    /ip hotspot set [find name="${hotspotServerName}"] interface=$lanBridge address-pool="${hotspotPoolName}" profile="${hotspotProfileName}" disabled=no
}
:if ([:len [/ppp profile find name="hq-pppoe-${cleanName.toLowerCase()}"]] = 0) do={
    /ppp profile add name="hq-pppoe-${cleanName.toLowerCase()}" local-address=${router.lanGateway} remote-address="${pppoePoolName}" dns-server=${router.dns} use-encryption=yes use-radius=yes
}
:if ([:len [/interface pppoe-server server find service-name="hq-pppoe-${cleanName.toLowerCase()}"]] = 0) do={
    /interface pppoe-server server add service-name="hq-pppoe-${cleanName.toLowerCase()}" interface=$lanBridge default-profile="hq-pppoe-${cleanName.toLowerCase()}" authentication=pap,chap,mschap1,mschap2 one-session-per-host=yes disabled=no
}

# 7. Firewall Rules (TATIZO 2 fix: Enforce vpnSubnet src-address restriction for management ports)
:if ([:len [/ip firewall filter find where comment="Allow HQInvestment API Access"]] = 0) do={
    /ip firewall filter add chain=input action=accept protocol=tcp dst-port=${apiPort},443,8291 src-address=${vpnSubnet} comment="Allow HQInvestment API Access"
}
:if ([:len [/ip firewall filter find where comment="Allow WireGuard VPN"]] = 0) do={
    /ip firewall filter add chain=input action=accept protocol=udp dst-port=51820 comment="Allow WireGuard VPN"
}
:if ([:len [/ip firewall filter find where comment="Allow RADIUS CoA"]] = 0) do={
    /ip firewall filter add chain=input action=accept protocol=udp dst-port=3799 ${coaVpnRestriction} comment="Allow RADIUS CoA"
}
# IMPORTANT: PPPoE clients terminate on dynamic pppoe-<user> interfaces, not on
# $lanBridge, so they are NOT affected by the LAN-forward drop rule below — but
# they DO need an explicit accept rule of their own, or they get no internet.
:if ([:len [/ip firewall filter find where comment="Allow PPPoE to Internet"]] = 0) do={
    /ip firewall filter add chain=forward in-interface=all-ppp out-interface-list=WAN action=accept comment="Allow PPPoE to Internet"
}
# SECURITY: blocks unauthenticated Hotspot/LAN clients on $lanBridge from reaching
# the internet directly. The MikroTik Hotspot engine intercepts and authenticates
# traffic from this bridge BEFORE it reaches this rule, so already-authenticated
# Hotspot users are expected to pass through untouched. VERIFY THIS on your setup
# after a real client logs in: run "/ip firewall filter print stats" and confirm
# the authenticated client's traffic is being counted as accepted, not dropped,
# before relying on this in production — do not assume, check.
:if ([:len [/ip firewall filter find where comment="Drop unauthenticated LAN forward"]] = 0) do={
    /ip firewall filter add chain=forward in-interface=$lanBridge action=drop comment="Drop unauthenticated LAN forward"
}

# 7b. Walled Garden — lets an unauthenticated client still reach the billing
# portal (to buy a voucher or pay) BEFORE they've logged in to the hotspot.
:if ([:len ["${walledGardenHost}"]] > 0) do={
    :if ([:len [/ip hotspot walled-garden find where comment="HQInvestment Billing Portal"]] = 0) do={
        /ip hotspot walled-garden add dst-host="${walledGardenHost}" action=allow comment="HQInvestment Billing Portal"
    }
}
:if ([:len [/ip hotspot walled-garden ip find where comment="HQInvestment Billing Portal IP"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address=${vpnIp} action=accept comment="HQInvestment Billing Portal IP"
}

# 8. NAT — REQUIRED for any authenticated client (hotspot or PPPoE) to actually
# reach the internet. Without this, login succeeds but browsing still fails.
:if ([:len [/ip firewall nat find where comment="HQInvestment NAT"]] = 0) do={
    /ip firewall nat add chain=srcnat action=masquerade out-interface-list=WAN comment="HQInvestment NAT"
}
`;

        if (router.wgPrivateKey && router.wgPeerPublicKey && router.wgTunnelIp) {
            // Try to resolve server endpoint from APP_URL if not explicitly set
            let resolvedEndpoint = router.wgServerEndpoint;
            if (!resolvedEndpoint && serverUrl) {
                try {
                    const url = new URL(serverUrl);
                    resolvedEndpoint = url.hostname;
                } catch (e) { }
            }
            const serverEndpoint = resolvedEndpoint || "YOUR_SERVER_IP";
            const listenPort = router.wgListenPort || 51820;

            script += `
# 9. WireGuard VPN Interface
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name=wg-hq listen-port=${listenPort} private-key="${router.wgPrivateKey}" comment="HQInvestment VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] private-key="${router.wgPrivateKey}"
}

# 10. WireGuard IP Address (/24 required for subnet routing — /32 breaks server→router replies)
# Remove stale /32 if present, then add /24
:foreach addr in=[/ip address find interface="wg-hq"] do={ /ip address remove $addr }
/ip address add address="${router.wgTunnelIp}/24" interface=wg-hq comment="HQInvestment VPN Address"

# 11. WireGuard Peer (Server)
:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${router.wgPeerPublicKey}"]] = 0) do={
    /interface wireguard peers add interface=wg-hq public-key="${router.wgPeerPublicKey}" allowed-address="${subnetPrefix}.0/24" endpoint-address="${serverEndpoint}" endpoint-port=${listenPort} persistent-keepalive=25s comment="HQInvestment ISP Server"
} else={
    /interface wireguard peers set [find interface="wg-hq" public-key="${router.wgPeerPublicKey}"] allowed-address="${subnetPrefix}.0/24" endpoint-address="${serverEndpoint}" endpoint-port=${listenPort} persistent-keepalive=25s
}

# 12. VPN Routing
:if ([:len [/ip route find dst-address="${subnetPrefix}.0/24" gateway="wg-hq"]] = 0) do={
    /ip route add dst-address="${subnetPrefix}.0/24" gateway=wg-hq comment="WireGuard route - HQInvestment"
}
`;
        }

        // 11. RADIUS Configuration (Managed via VPN or Public IP)
        let publicIp = "";

        try {
            if (serverUrl) {
                const url = new URL(serverUrl);
                publicIp = url.hostname;
            }
        } catch (e) {
            logger.warn('[Script] Failed to parse APP_URL for RADIUS address', {
                error: e instanceof Error ? e.message : String(e),
            });
        }

        const requestHost = process.env.SERVER_PUBLIC_IP || req.nextUrl.hostname;
        const radiusAddr = router.wgTunnelIp ? vpnIp : (publicIp || requestHost || "YOUR_SERVER_IP");
        const srcAddrPart = router.wgTunnelIp ? `src-address=${router.wgTunnelIp}` : "";

        // Avoid embedding raw secrets in generated scripts for non-super-admins.
        // Only SUPER_ADMIN should receive a script containing plaintext credentials.
        if (userPayload.role === "SUPER_ADMIN") {
            script += `
# 11. RADIUS Configuration
:if ([:len [/radius find where comment="HQInvestment RADIUS"]] = 0) do={
    /radius add address=${radiusAddr} secret="${router.radiusSecret}" service=hotspot,ppp timeout=3000ms ${srcAddrPart} comment="HQInvestment RADIUS"
} else={
    /radius set [find comment="HQInvestment RADIUS"] address=${radiusAddr} secret="${router.radiusSecret}" ${srcAddrPart}
}
:if ([:len [/radius incoming find]] = 0) do={
    /radius incoming set accept=yes port=3799
}

# 12. Enable RADIUS & SSL/TLS for Hotspot and PPP Services (TATIZO 3 Hotspot SSL fix)
# SECURITY FIX: http-pap removed (plaintext password over the wire).
/ip hotspot profile set [find default=yes] use-radius=yes ssl-certificate=auto login-by=http-chap,https,cookie
/ppp profile set [find name=default] use-radius=yes
/log info "RADIUS & SSL services enabled for Hotspot and PPP"

# 13. Success Notification
/log info "HQInvestment Configuration completed successfully!"
/log info "Your router should now be reachable by the billing system."
`;
        } else {
            script += `
# 11. RADIUS Configuration (REDACTED)
# Your account doesn't have permission to view router credentials. Contact a Super Admin to obtain a full setup script.
# To manually configure RADIUS, add a NAS entry on the billing server with this router's IP and shared secret.

# 12. Enable RADIUS & SSL/TLS for Hotspot and PPP Services (no secret embedded)
# SECURITY FIX: http-pap removed (plaintext password over the wire).
/ip hotspot profile set [find default=yes] use-radius=yes ssl-certificate=auto login-by=http-chap,https,cookie
/ppp profile set [find name=default] use-radius=yes
# 13. Success Notification
/log info "HQInvestment Configuration completed (credentials redacted)."
`;
        }

        // Security Linter Check (P0): Ensure no accept rule for management ports runs without src-address constraint
        const lines = script.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || trimmed === "") continue;
            if (trimmed.includes("action=accept") &&
                (trimmed.includes("dst-port=8291") ||
                    trimmed.includes("dst-port=80") ||
                    trimmed.includes("dst-port=443") ||
                    trimmed.includes("dst-port=8728") ||
                    trimmed.includes("dst-port=8729") ||
                    trimmed.includes("dst-port=" + apiPort))) {

                if (!trimmed.includes("src-address=")) {
                    return errorResponse(`Security Linter Reject: Rule lacks mandatory src-address restriction: ${trimmed}`, 500);
                }
            }
        }

        const safeFilename = router.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // Replace any non-alphanumeric with a single dash
            .replace(/^-+|-+$/g, '');   // Remove leading/trailing dashes
        return new Response(script, {
            headers: {
                "Content-Type": "text/plain",
                "Content-Disposition": `attachment; filename="setup-${safeFilename}.rsc"`,
            },
        });
    } catch (e: any) {
        logger.error('[Script] Failed to generate router setup script', {
            error: e instanceof Error ? e.message : String(e),
        });
        return errorResponse("Failed to generate script", 500);
    }
}
