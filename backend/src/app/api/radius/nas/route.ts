import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";
import logger from "@/lib/logger";

// GET /api/radius/nas – list NAS clients (tenant-isolated)
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter } = getTenantFilter(userPayload);

        const nasList = await db.radiusNas.findMany({
            where: { ...filter },
            orderBy: { createdAt: "desc" },
        });

        function maskSecret(s: string | null | undefined) {
            if (!s) return null;
            if (s.length <= 4) return "****";
            return `****${s.slice(-4)}`;
        }

        const result = nasList.map(n => ({
            id: n.id,
            nasName: n.nasName,
            shortName: n.shortName || "",
            type: n.type,
            ports: n.ports,
            // Only reveal the raw secret to SUPER_ADMINs — others get a masked value
            secret: userPayload.role === "SUPER_ADMIN" ? n.secret : maskSecret(n.secret),
            server: n.server || "",
            description: n.description || "",
            createdAt: new Date(n.createdAt).toLocaleDateString(),
        }));

        return jsonResponse(result);
    } catch (e) {
        logger.error("NAS list error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/radius/nas – create NAS client (tenant-isolated)
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const body = await req.json();
        const { nasName, shortName, type, ports, secret, server, description } = body;

        if (!nasName || !secret) {
            return errorResponse("NAS name and secret are required", 400);
        }

        const tenantId = getAssignTenantId(userPayload, body.tenantId);

        const nas = await db.radiusNas.create({
            data: {
                nasName,
                shortName: shortName || null,
                type: type || "other",
                ports: ports || 0,
                secret,
                server: server || null,
                description: description || null,
                tenantId,
            },
        });

        return jsonResponse(nas, 201);
    } catch (e) {
        logger.error("NAS create error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

