import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { sendAccountApprovedNotifications } from "@/lib/accountNotifications";
import logger from "@/lib/logger";


// GET /api/super-admin/tenants — list all tenants
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        if (userPayload.tenantId) return errorResponse("Unauthorized", 403);
        const db = getTenantClient(null);

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const page   = Math.max(1, parseInt(searchParams.get("page")  || "1"));
        const limit  = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));
        const skip   = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name:  { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        // HIGH-PERF FIX: Was fully unbounded — now paginated with skip/take.
        const [tenants, total] = await Promise.all([
            db.tenant.findMany({
                where,
                orderBy: { createdAt: "desc" },
                include: {
                    users: {
                        where:  { role: "ADMIN" },
                        select: { email: true, fullName: true, phone: true },
                    },
                    plan: { select: { name: true } },
                },
                skip,
                take: limit,
            }),
            db.tenant.count({ where }),
        ]);

        const mapped = tenants.map(t => ({
            id:               t.id,
            name:             t.name,
            email:            t.email,
            phone:            t.phone,
            status:           t.status,
            planName:         t.plan?.name,
            createdAt:        t.createdAt,
            trialEnd:         t.trialEnd,
            licenseExpiresAt: t.licenseExpiresAt,
            primaryUser:      t.users[0]?.fullName || "N/A",
        }));

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        logger.error("Super Admin Tenants List Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/super-admin/tenants/approve — manage tenant accounts
// Body: { tenantId, action?: "approve" | "suspend" | "reactivate" }
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        if (userPayload.tenantId) return errorResponse("Unauthorized", 403);
        const db = getTenantClient(null);

        const body = await req.json();
        const { tenantId, action } = body;

        if (!tenantId) {
            return errorResponse("tenantId is required", 400);
        }

        const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
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

            await db.tenant.update({
                where: { id: tenantId },
                data: { status: "TRIALLING", trialStart, trialEnd }
            });

            await sendAccountApprovedNotifications({
                tenantId: tenant.id,
                tenantName: tenant.name,
                email: tenant.email,
                phone: tenant.phone,
            });

            return jsonResponse({
                message: `Tenant "${tenant.name}" approved. 10-day trial starts now (ends ${trialEnd.toDateString()}).`
            });
        }

        // ── Suspend ───────────────────────────────────────────────────────────
        if (action === "suspend") {
            await db.tenant.update({
                where: { id: tenantId },
                data: { status: "SUSPENDED" }
            });
            return jsonResponse({ message: `Tenant "${tenant.name}" suspended.` });
        }

        // ── Reactivate ────────────────────────────────────────────────────────
        if (action === "reactivate") {
            await db.tenant.update({
                where: { id: tenantId },
                data: { status: "ACTIVE" }
            });
            return jsonResponse({ message: `Tenant "${tenant.name}" reactivated.` });
        }

        return errorResponse("Unknown action. Use: approve | suspend | reactivate", 400);

    } catch (e) {
        logger.error("Super Admin Tenant Action Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

