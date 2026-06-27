import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/tenant";


// GET /api/admin/tenants - list all tenants (Super Admin only)
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const user = guard.user;
        if (!isPlatformSuperAdmin(user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(null);

        const tenants = await db.tenant.findMany({
            include: {
                plan: true,
                _count: {
                    select: {
                        clients: true,
                        users: true,
                        routers: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        const mapped = tenants.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email,
            phone: t.phone,
            status: t.status,
            plan: t.plan.name,
            clientCount: t._count.clients,
            userCount: t._count.users,
            routerCount: t._count.routers,
            trialEnd: t.trialEnd,
            createdAt: t.createdAt
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error("ADMIN TENANT FETCH ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/admin/tenants - create/confirm/update tenant (Super Admin only)
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const user = guard.user;
        if (!isPlatformSuperAdmin(user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(null);

        const body = await req.json();
        const { action, tenantId, ...data } = body;

        if (action === "confirm") {
            const updated = await db.tenant.update({
                where: { id: tenantId },
                data: { status: "ACTIVE" }
            });
            return jsonResponse({ message: "Tenant confirmed successfully", tenant: updated });
        }

        if (action === "suspend") {
            const updated = await db.tenant.update({
                where: { id: tenantId },
                data: { status: "SUSPENDED" }
            });
            return jsonResponse({ message: "Tenant suspended successfully", tenant: updated });
        }

        // Add more actions as needed...
        return errorResponse("Invalid action provided", 400);

    } catch (e) {
        console.error("ADMIN TENANT ACTION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

