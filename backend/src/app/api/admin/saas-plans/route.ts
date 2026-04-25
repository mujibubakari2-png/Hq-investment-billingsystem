import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";


// GET /api/admin/saas-plans - list all SaaS plans (Super Admin only)
export async function GET(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const plans = await prisma.saasPlan.findMany({
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
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const body = await req.json();
        const { action, planId, name, price, clientLimit } = body;

        if (action === "create") {
            const newPlan = await prisma.saasPlan.create({
                data: {
                    name,
                    price: parseFloat(price),
                    clientLimit: parseInt(clientLimit)
                }
            });
            return jsonResponse({ message: "SaaS plan created successfully", plan: newPlan }, 201);
        }

        if (action === "update") {
            const updated = await prisma.saasPlan.update({
                where: { id: planId },
                data: {
                    name,
                    price: price !== undefined ? parseFloat(price) : undefined,
                    clientLimit: clientLimit !== undefined ? parseInt(clientLimit) : undefined
                }
            });
            return jsonResponse({ message: "SaaS plan updated successfully", plan: updated });
        }

        if (action === "delete") {
            await prisma.saasPlan.delete({ where: { id: planId } });
            return jsonResponse({ message: "SaaS plan deleted successfully" });
        }

        return errorResponse("Invalid action provided", 400);

    } catch (e) {
        console.error("ADMIN SAAS PLAN ACTION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
