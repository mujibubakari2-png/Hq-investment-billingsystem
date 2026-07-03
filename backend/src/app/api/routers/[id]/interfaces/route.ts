import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { requirePermission } from "@/lib/rbac";
import logger from "@/lib/logger";


export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const service = await getMikroTikService(id, userPayload.tenantId ?? null);
        const interfaces = await service.listInterfaces();

        return jsonResponse(interfaces);
    } catch (e: any) {
        logger.error("[INTERFACES GET ERROR]:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Failed to fetch interfaces", 500);
    }
}
