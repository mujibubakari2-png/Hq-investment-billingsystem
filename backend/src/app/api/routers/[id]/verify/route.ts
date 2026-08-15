import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import { MikroTikService } from "@/lib/mikrotik";
import { decryptRouterFields } from "@/lib/encryption";
import logger from "@/lib/logger";
import { verifyRouterServices } from "@/lib/routerVerification";
import { resolveRouterManagementTarget } from "@/lib/routerAddressResolver";


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;

        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { id } = await params;

        const router = await db.router.findUnique({ where: { id } });
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized", 403);
        }

        // Use the resolver to safely target the router for backend operations
        const target = resolveRouterManagementTarget(router as any, 'BACKEND_API');
        const decryptedRouter = decryptRouterFields(router);
        
        const service = new MikroTikService({
            host: target.host,
            port: target.port || router.apiPort || router.port || 8728,
            username: decryptedRouter.username!,
            password: decryptedRouter.password || "",
        }, router.id, router.tenantId);

        const verification = await verifyRouterServices(service);

        // Update database status based on granular results
        let status = 'OFFLINE' as any;
        if (verification.overallReady) {
            status = 'READY';
        } else if (verification.api.authenticated) {
            status = 'PARTIAL_FAILURE';
        }

        if (router.status !== status) {
            await db.router.update({
                where: { id },
                data: { status }
            });
        }

        return jsonResponse({
            success: true,
            status,
            verification
        });
    } catch (err: any) {
        logger.error("[ROUTER-VERIFY] Error", { error: err.message });
        return errorResponse("Internal server error during verification", 500);
    }
}
