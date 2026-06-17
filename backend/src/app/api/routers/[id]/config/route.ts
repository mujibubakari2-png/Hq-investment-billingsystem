import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";

/**
 * GET /api/routers/[id]/config
 * 
 * Returns the technical configuration details for a specific router.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const router = await db.router.findUnique({
            where: { id },
            include: {
                tenant: { select: { name: true } }
            }
        });

        if (!router) return errorResponse("Router not found", 404);
        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized", 403);
        }

        const config = {
            id: router.id,
            name: router.name,
            host: router.host,
            port: router.port || 8728,
            apiPort: router.apiPort || 80,
            username: router.username,
            vpnMode: router.vpnMode || "NONE",
            status: router.status,
            accountingEnabled: router.accountingEnabled,
            tenant: router.tenant?.name || "N/A",
            lastSeen: router.updatedAt,
            links: {
                test: `/api/routers/${router.id}/test`,
                script: `/api/routers/${router.id}/script`,
                wireguard: `/api/routers/${router.id}/wireguard`,
                interfaces: `/api/routers/${router.id}/interfaces`
            }
        };

        return jsonResponse(config);
    } catch (e: any) {
        console.error("[CONFIG ERROR]:", e);
        return errorResponse("Failed to fetch configuration", 500);
    }
}
