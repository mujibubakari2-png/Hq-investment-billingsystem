import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { decryptRouterFields } from "@/lib/encryption";

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

        const router = decryptRouterFields(routerRaw);

        const apiPort = router.apiPort || 80;
        const serverUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";

        const cleanName = router.name.trim().replace(/^-+|-+$/g, '');

        let script = `# HQInvestment ISP Billing System - Router Setup Script
# Generated for: ${cleanName}
# Date: ${new Date().toISOString()}
#
# ==============================================================================
# ⚠️ SECURITY WARNING: This script contains plaintext passwords and VPN keys!
# After pasting this script into your router, please DELETE this file from your 
# computer immediately to prevent credential theft.
# ==============================================================================

/log info "Starting HQInvestment Auto-Configuration..."

# 1. Set System Identity
/system identity set name="${cleanName}"

# 2. Enable REST API (WWW-SSL is preferred, WWW is fallback)
/ip service set www-ssl disabled=no port=443
/ip service set www disabled=no port=${apiPort}
/log info "REST API services enabled on port 443 and ${apiPort}"

# 3. Create Management User (if not exists)
:if ([:len [/user find name="admin"]] = 0) do={
    /user add name="admin" password="${router.password || ''}" group=full comment="HQInvestment Admin"
} else={
    /user set [find name="admin"] password="${router.password || ''}" group=full
}

# 4. Keep Winbox MAC and neighbor discovery reachable
/tool mac-server set allowed-interface-list=all
/tool mac-server mac-winbox set allowed-interface-list=all
/ip neighbor discovery-settings set discover-interface-list=all

# 5. DNS and NTP (Critical for handshakes)
/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes
/system ntp client set enabled=yes
:if ([:len [/system ntp client servers find where address="pool.ntp.org"]] = 0) do={
    /system ntp client servers add address=pool.ntp.org
}

# 6. Firewall Rules (idempotent)
:if ([:len [/ip firewall filter find where comment="Allow HQInvestment API Access"]] = 0) do={
    /ip firewall filter add chain=input action=accept protocol=tcp dst-port=${apiPort},443,8291 comment="Allow HQInvestment API Access"
}
:if ([:len [/ip firewall filter find where comment="Allow WireGuard VPN"]] = 0) do={
    /ip firewall filter add chain=input action=accept protocol=udp dst-port=51820 comment="Allow WireGuard VPN"
}
:if ([:len [/ip firewall filter find where comment="Allow RADIUS CoA"]] = 0) do={
    /ip firewall filter add chain=input action=accept protocol=udp dst-port=3799 src-address=10.0.0.1 comment="Allow RADIUS CoA"
}
`;

        if (router.wgPrivateKey && router.wgPeerPublicKey && router.wgTunnelIp) {
            const subnetPrefix = "10.0.0"; // Fallback, normally should be fetched from wgServerIp

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
# 7. WireGuard VPN Interface
:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={
    /interface wireguard add name=wg-hq listen-port=${listenPort} private-key="${router.wgPrivateKey}" comment="HQInvestment VPN Interface"
} else={
    /interface wireguard set [find name="wg-hq"] private-key="${router.wgPrivateKey}"
}

# 8. WireGuard IP Address
:if ([:len [/ip address find interface="wg-hq"]] = 0) do={
    /ip address add address="${router.wgTunnelIp}/24" interface=wg-hq network="${subnetPrefix}.0" comment="HQInvestment VPN Address"
}

# 9. WireGuard Peer (Server)
:if ([:len [/interface wireguard peers find interface="wg-hq"]] = 0) do={
    /interface wireguard peers add interface=wg-hq public-key="${router.wgPeerPublicKey}" allowed-address="0.0.0.0/0,::/0" endpoint-address="${serverEndpoint}" endpoint-port=51820 persistent-keepalive=25s comment="HQInvestment ISP Server"
}

# 10. VPN Routing
:if ([:len [/ip route find gateway="wg-hq"]] = 0) do={
    /ip route add dst-address="${subnetPrefix}.0/24" gateway=wg-hq comment="WireGuard route - HQInvestment"
}
`;
        }

        // 11. RADIUS Configuration (Managed via VPN or Public IP)
        const vpnIp = "10.0.0.1";
        let publicIp = "";

        try {
            if (serverUrl) {
                const url = new URL(serverUrl);
                publicIp = url.hostname;
            }
        } catch (e) {
            console.error("Failed to parse APP_URL for RADIUS address:", e);
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
    /radius add address=${radiusAddr} secret="${router.password || 'hqsecret'}" service=hotspot,ppp timeout=3000ms ${srcAddrPart} comment="HQInvestment RADIUS"
} else={
    /radius set [find comment="HQInvestment RADIUS"] address=${radiusAddr} secret="${router.password || 'hqsecret'}" ${srcAddrPart}
}
:if ([:len [/radius incoming find]] = 0) do={
    /radius incoming set accept=yes port=3799
}

# 12. Enable RADIUS for Hotspot and PPP Services
/ip hotspot profile set [find default=yes] use-radius=yes
/ppp profile set [find name=default] use-radius=yes
/log info "RADIUS services enabled for Hotspot and PPP"

# 13. Success Notification
/log info "HQInvestment Configuration completed successfully!"
/log info "Your router should now be reachable by the billing system."
`;
        } else {
            script += `
# 11. RADIUS Configuration (REDACTED)
# Your account doesn't have permission to view router credentials. Contact a Super Admin to obtain a full setup script.
# To manually configure RADIUS, add a NAS entry on the billing server with this router's IP and shared secret.

# 12. Enable RADIUS for Hotspot and PPP Services (no secret embedded)
/ip hotspot profile set [find default=yes] use-radius=yes
/ppp profile set [find name=default] use-radius=yes
# 13. Success Notification
/log info "HQInvestment Configuration completed (credentials redacted)."
`;
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
        console.error("[SCRIPT ERROR]:", e);
        return errorResponse("Failed to generate script", 500);
    }
}
