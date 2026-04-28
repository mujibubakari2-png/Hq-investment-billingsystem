import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest, errorResponse, jsonResponse } from "@/lib/auth";

/**
 * GET /api/routers/[id]/config
 * 
 * Returns the technical configuration details for a specific router.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const router = await prisma.router.findUnique({
            where: { id },
            include: {
                tenant: { select: { name: true } }
            }
        });
        
        if (!router) return errorResponse("Router not found", 404);
        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
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
