import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

/**
 * GET  /api/super-admin/licenses         — list all tenant license records
 * POST /api/super-admin/licenses         — manually approve/create a license
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * This endpoint manages PLATFORM licenses only (TenantLicense + TenantInvoice).
 * It does NOT expose any of the tenant's own client data.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const tenantId = searchParams.get("tenantId") || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Prisma.TenantLicenseWhereInput = {};
        if (status) where.status = status as any;
        if (tenantId) where.tenantId = tenantId;

        const [licenses, total] = await Promise.all([
            db.tenantLicense.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    tenant: {
                        select: { id: true, name: true, email: true, status: true },
                    },
                    plan: {
                        select: { id: true, name: true, price: true },
                    },
                },
            }),
            db.tenantLicense.count({ where }),
        ]);

        return jsonResponse({
            data: licenses.map((l) => ({
                id: l.id,
                tenantId: l.tenantId,
                tenantName: l.tenant.name,
                tenantEmail: l.tenant.email,
                tenantStatus: l.tenant.status,
                planId: l.planId,
                planName: l.plan.name,
                planPrice: Number(l.plan.price),
                status: l.status,
                startsAt: l.startsAt,
                expiresAt: l.expiresAt,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (e) {
        logger.error("Super Admin GET Licenses Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        const { tenantId, planId, startsAt, expiresAt, action } = body;

        if (!tenantId || !planId) {
            return errorResponse("tenantId and planId are required", 400);
        }

        const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return errorResponse("Tenant not found", 404);

        const plan = await db.saasPlan.findUnique({ where: { id: planId } });
        if (!plan) return errorResponse("Plan not found", 404);

        const startDate = startsAt ? new Date(startsAt) : new Date();
        const endDate = expiresAt
            ? new Date(expiresAt)
            : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // default 30 days

        // Create license record
        const license = await db.tenantLicense.create({
            data: {
                tenantId,
                planId,
                status: action === "approve" ? "PAID" : "PENDING",
                startsAt: startDate,
                expiresAt: endDate,
            },
        });

        // If manually approved, update tenant's license expiry and ensure ACTIVE status
        if (action === "approve") {
            await db.tenant.update({
                where: { id: tenantId },
                data: {
                    licenseExpiresAt: endDate,
                    planId,
                    status: "ACTIVE",
                },
            });
        }

        await writeAuditLog({
            tenantId,
            userId: guard.user.userId,
            action: "PLATFORM_MANUAL_LICENSE_APPROVAL",
            resource: "TenantLicense",
            resourceId: license.id,
            details: { planId, planName: plan.name, startsAt: startDate, expiresAt: endDate, action },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({
            message: `License ${action === "approve" ? "approved and activated" : "created"} for "${tenant.name}".`,
            license: { ...license },
        }, 201);
    } catch (e) {
        logger.error("Super Admin POST License Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
