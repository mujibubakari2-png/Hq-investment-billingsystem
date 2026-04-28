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

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://your-server-ip:3000";
        const apiPort = router.apiPort || 80;

        const script = `# HQInvestment ISP Billing System - Router Setup Script
# Generated for: ${router.name}
# Date: ${new Date().toISOString()}

/log info "Starting HQInvestment Auto-Configuration..."

# 1. Set System Identity
/system identity set name="${router.name}"

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

# 4. DNS and NTP (Critical for handshakes)
/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes
/system ntp client set enabled=yes
/system ntp client servers add address=pool.ntp.org

# 5. Firewall Rules (Basic access for the billing system)
/ip firewall filter
add chain=input action=accept protocol=tcp dst-port=${apiPort},443 comment="Allow HQInvestment API Access" place-before=0
add chain=input action=accept protocol=udp dst-port=51820 comment="Allow WireGuard VPN" place-before=0

# 6. Success Notification
/log info "HQInvestment Configuration completed successfully!"
/log info "Your router should now be reachable by the billing system."
`;

        return new Response(script, {
            headers: {
                "Content-Type": "text/plain",
                "Content-Disposition": `attachment; filename="setup-${router.name}.rsc"`,
            },
        });
    } catch (e: any) {
        console.error("[SCRIPT ERROR]:", e);
        return errorResponse("Failed to generate script", 500);
    }
}
