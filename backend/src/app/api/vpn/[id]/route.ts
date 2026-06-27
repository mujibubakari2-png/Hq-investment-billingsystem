import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { decrypt } from "@/lib/encryption";
import { canAccessTenant, isPlatformSuperAdmin } from "@/lib/tenant";

// DELETE /api/vpn/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "vpn:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        if (!isPlatformSuperAdmin(userPayload)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(userPayload);

        const { id } = await params;

        // ── 1. Fetch user to get routerId and username ──
        const vpnUser = await db.vpnUser.findFirst({ where: { id } });
        if (!vpnUser) return errorResponse("VPN user not found", 404);
        if (!canAccessTenant(userPayload, vpnUser.tenantId)) return errorResponse("VPN user not found", 404);

        // ── 2. Delete from MikroTik ──
        try {
            const { getMikroTikService } = await import("@/lib/mikrotik");
            const mt = await getMikroTikService(vpnUser.routerId, userPayload.tenantId ?? null);

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
