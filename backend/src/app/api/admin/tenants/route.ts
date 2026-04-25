import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";


// GET /api/admin/tenants - list all tenants (Super Admin only)
export async function GET(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const tenants = await prisma.tenant.findMany({
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
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const body = await req.json();
        const { action, tenantId, ...data } = body;

        if (action === "confirm") {
            const updated = await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: "ACTIVE" }
            });
            return jsonResponse({ message: "Tenant confirmed successfully", tenant: updated });
        }

        if (action === "suspend") {
            const updated = await prisma.tenant.update({
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
