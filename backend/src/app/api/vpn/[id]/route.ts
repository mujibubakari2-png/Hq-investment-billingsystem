import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// DELETE /api/vpn/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        
        // ── 1. Fetch user to get routerId and username ──
        const vpnUser = await prisma.vpnUser.findUnique({ where: { id } });
        if (!vpnUser) return errorResponse("VPN user not found", 404);

        // ── 2. Delete from MikroTik ──
        if (vpnUser.protocol !== "WireGuard") {
            try {
                const { getMikroTikService } = await import("@/lib/mikrotik");
                const mt = await getMikroTikService(vpnUser.routerId, userPayload.tenantId);
                await mt.deleteVpnUser(vpnUser.username);
            } catch (err) {
                console.error("Failed to delete VPN user from MikroTik:", err);
                // Continue to delete from DB anyway
            }
        }

        // ── 3. Delete from DB ──
        await prisma.vpnUser.delete({ where: { id } });
        return jsonResponse({ message: "VPN user deleted" });
    } catch (e) {
        console.error("VPN delete error:", e);
        return errorResponse("Internal server error", 500);
    }
}
