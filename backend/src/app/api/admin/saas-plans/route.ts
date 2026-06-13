import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/admin/saas-plans - list all SaaS plans (Super Admin only)
export async function GET(req: NextRequest) {
    try {
        const db = getTenantClient(null);
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN" || user.tenantId) {
            return errorResponse("Forbidden: Platform Admin access required", 403);
        }

        const plans = await db.saasPlan.findMany({
            orderBy: { price: 'asc' }
        });

        return jsonResponse(plans);
    } catch (e) {
        console.error("ADMIN SAAS PLAN FETCH ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/admin/saas-plans - create/update SaaS plans (Super Admin only)
export async function POST(req: NextRequest) {
    try {
        const db = getTenantClient(null);
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN" || user.tenantId) {
            return errorResponse("Forbidden: Platform Admin access required", 403);
        }

        const body = await req.json();
        const { action, planId, name, price, pppoeLimit, hotspotLimit, maxRouters } = body;

        if (action === "create") {
            const newPlan = await db.saasPlan.create({
                data: {
                    name,
                    price: parseFloat(price),
                    pppoeLimit: parseInt(pppoeLimit),
                    hotspotLimit: hotspotLimit ? parseInt(hotspotLimit) : null,
                    maxRouters: maxRouters ? parseInt(maxRouters) : 1
                }
            });
            return jsonResponse({ message: "SaaS plan created successfully", plan: newPlan }, 201);
        }

        if (action === "update") {
            const updated = await db.saasPlan.update({
                where: { id: planId },
                data: {
                    name,
                    price: price !== undefined ? parseFloat(price) : undefined,
                    pppoeLimit: pppoeLimit !== undefined ? parseInt(pppoeLimit) : undefined,
                    hotspotLimit: hotspotLimit !== undefined ? (hotspotLimit ? parseInt(hotspotLimit) : null) : undefined,
                    maxRouters: maxRouters !== undefined ? parseInt(maxRouters) : undefined
                }
            });
            return jsonResponse({ message: "SaaS plan updated successfully", plan: updated });
        }

        if (action === "delete") {
            await db.saasPlan.delete({ where: { id: planId } });
            return jsonResponse({ message: "SaaS plan deleted successfully" });
        }

        return errorResponse("Invalid action provided", 400);

    } catch (e) {
        console.error("ADMIN SAAS PLAN ACTION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
