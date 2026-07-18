import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";

const WINBOX_SESSION_TTL_SECONDS = 15 * 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;

        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { id } = await params;

        const router = await db.router.findUnique({ where: { id } });
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        const body = await req.json().catch(() => ({}));
        const requestedPort = Number(body?.winboxPort ?? 8291);
        const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8291;

        return jsonResponse({
            host: router.host,
            port,
            expiresInSeconds: WINBOX_SESSION_TTL_SECONDS,
            instructions: `Open WinBox, choose Connect To, and enter ${router.host}:${port}. Use the router admin credentials.`,
        });
    } catch {
        return errorResponse("Failed to open WinBox session", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const { id } = await params;
        const queryPort = req.nextUrl.searchParams.get("port");
        const port = queryPort ? Number(queryPort) : undefined;

        return jsonResponse({ success: true, routerId: id, port });
    } catch {
        return errorResponse("Failed to close WinBox session", 500);
    }
}
