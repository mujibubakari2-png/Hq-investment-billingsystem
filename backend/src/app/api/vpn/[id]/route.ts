import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

// DELETE /api/vpn/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        
        // ── 1. Fetch user to get routerId and username ──
        const vpnUser = await db.vpnUser.findFirst({ 
            where: { id, tenantId: userPayload.tenantId } 
        });
        if (!vpnUser) return errorResponse("VPN user not found", 404);

        // ── 2. Delete from MikroTik ──
        try {
            const { getMikroTikService } = await import("@/lib/mikrotik");
            const mt = await getMikroTikService(vpnUser.routerId, userPayload.tenantId);
            
            if (vpnUser.protocol === "WireGuard") {
                // Delete peer by public key (stored in password) or comment
                const pk = decrypt(vpnUser.password) ?? vpnUser.password;
                await mt.deleteWireGuardPeer(pk || `VPN:${vpnUser.username}`);
            } else {
                await mt.deleteVpnUser(vpnUser.username);
            }
        } catch (err) {
            console.error("Failed to delete VPN user from MikroTik:", err);
            // Continue to delete from DB anyway
        }

        // ── 3. Delete from DB ──
        await db.vpnUser.delete({ where: { id } });
        return jsonResponse({ message: "VPN user deleted" });
    } catch (e) {
        console.error("VPN delete error:", e);
        return errorResponse("Internal server error", 500);
    }
}
