import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest, errorResponse } from "@/lib/auth";

/**
 * GET /api/routers/[id]/script
 * 
 * Generates a MikroTik RouterOS script that the user can copy and paste 
 * into their router terminal to automatically configure it for HQInvestment.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const router = await prisma.router.findUnique({ where: { id } });
        
        if (!router) return errorResponse("Router not found", 404);
        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized", 403);
        }

        // WireGuard server tunnel IP — from env var or default (never hardcode)
        const wgServerIp = process.env.WG_SERVER_IP || process.env.WIREGUARD_SERVER_IP || "10.0.0.1";
        const apiPort = router.apiPort || 80;

        const cleanName = router.name.trim().replace(/^-+|-+$/g, '');
        
        let script = `# HQInvestment ISP Billing System - Router Setup Script
# Generated for: ${cleanName}
# Date: ${new Date().toISOString()}

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
    /ip firewall filter add chain=input action=accept protocol=udp dst-port=3799 src-address=${wgServerIp} comment="Allow RADIUS CoA"
}
`;

        if (router.wgPrivateKey && router.wgPeerPublicKey && router.wgTunnelIp) {
            const subnetPrefix = router.wgTunnelIp.split('.').slice(0, 3).join('.');
            const serverEndpoint = router.wgServerEndpoint || wgServerIp;
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

        // 11. RADIUS Configuration (Managed via VPN)
        const srcAddrPart = router.wgTunnelIp ? `src-address=${router.wgTunnelIp}` : "";

        script += `
# 11. RADIUS Configuration (Managed via WireGuard VPN)
:if ([:len [/radius find where comment="HQInvestment RADIUS"]] = 0) do={
    /radius add address=${wgServerIp} secret="${router.password || process.env.RADIUS_NAS_SECRET || 'hqinvestment_radius_secret'}" service=hotspot,ppp timeout=3000ms ${srcAddrPart} authentication-port=1812 accounting-port=1813 comment="HQInvestment RADIUS"
} else={
    /radius set [find comment="HQInvestment RADIUS"] address=${wgServerIp} secret="${router.password || process.env.RADIUS_NAS_SECRET || 'hqinvestment_radius_secret'}" ${srcAddrPart}
}
:if ([:len [/radius incoming find]] = 0) do={
    /radius incoming set accept=yes port=3799
}

# 12. Success Notification
/log info "HQInvestment Configuration completed successfully!"
/log info "Your router should now be reachable by the billing system."
`;

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
