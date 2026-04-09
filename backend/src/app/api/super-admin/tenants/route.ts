import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/super-admin/tenants — list all tenants
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload || userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Unauthorized", 403);
        }

        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                users: {
                    where: { role: "ADMIN" },
                    select: { email: true, fullName: true, phone: true }
                },
                plan: { select: { name: true } }
            }
        });

        const mapped = tenants.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email,
            phone: t.phone,
            status: t.status,
            planName: t.plan?.name,
            createdAt: t.createdAt,
            trialEnd: t.trialEnd,
            licenseExpiresAt: t.licenseExpiresAt,
            primaryUser: t.users[0]?.fullName || "N/A"
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error("Super Admin Tenants List Error:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/super-admin/tenants/approve — manage tenant accounts
// Body: { tenantId, action?: "approve" | "suspend" | "reactivate" }
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload || userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Unauthorized", 403);
        }

        const body = await req.json();
        const { tenantId, action } = body;

        if (!tenantId) {
            return errorResponse("tenantId is required", 400);
        }

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return errorResponse("Tenant not found", 404);
        }

        // ── Approve & Start Trial ─────────────────────────────────────────────
        if (!action || action === "approve") {
            if (tenant.status !== "PENDING_APPROVAL") {
                return errorResponse(`Tenant is already ${tenant.status} — cannot approve again.`, 400);
            }

            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 10);

            await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: "TRIALLING", trialStart, trialEnd }
            });

            return jsonResponse({
                message: `Tenant "${tenant.name}" approved. 10-day trial starts now (ends ${trialEnd.toDateString()}).`
            });
        }

        // ── Suspend ───────────────────────────────────────────────────────────
        if (action === "suspend") {
            await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: "SUSPENDED" }
            });
            return jsonResponse({ message: `Tenant "${tenant.name}" suspended.` });
        }

        // ── Reactivate ────────────────────────────────────────────────────────
        if (action === "reactivate") {
            await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: "ACTIVE" }
            });
            return jsonResponse({ message: `Tenant "${tenant.name}" reactivated.` });
        }

        return errorResponse("Unknown action. Use: approve | suspend | reactivate", 400);

    } catch (e) {
        console.error("Super Admin Tenant Action Error:", e);
        return errorResponse("Internal server error", 500);
    }
}
