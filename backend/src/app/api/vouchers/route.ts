import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getTenantFilter } from "@/lib/tenant";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { VoucherCreateSchema } from "@/lib/validators";
import { toISOSafe, toTimestampSafe } from "@/lib/dateUtils";
import logger from "@/lib/logger";
import crypto from "crypto";

/**
 * Generate a cryptographically secure numeric voucher code (6 digits).
 *
 * HIGH-SEC FIX: Math.random() was replaced with crypto.randomBytes().
 * Math.random() is NOT a CSPRNG — voucher codes are predictable.
 * An attacker observing timing or seeding the PRNG can enumerate all codes
 * issued in a session. Rejection-sampling ensures uniform 000000–999999 distribution.
 */
function generateVoucherCode(): string {
    const MAX = 1_000_000;
    const REJECT_THRESHOLD = (1 << 24) - ((1 << 24) % MAX); // avoid modulo bias
    while (true) {
        const buf = crypto.randomBytes(3);
        const val = (buf[0] << 16) | (buf[1] << 8) | buf[2];
        if (val < REJECT_THRESHOLD) {
            return (val % MAX).toString().padStart(6, "0");
        }
    }
}

// GET /api/vouchers
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "vouchers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";
        const page   = Math.max(1, parseInt(searchParams.get("page")  || "1"));
        const limit  = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "50")));
        const skip   = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { code:   { contains: search, mode: "insensitive" } },
                { usedBy: { contains: search, mode: "insensitive" } },
            ];
        }

        const [vouchers, total] = await Promise.all([
            db.voucher.findMany({
                where,
                include: {
                    package:   { select: { name: true, type: true } },
                    router:    { select: { name: true } },
                    createdBy: { select: { username: true, fullName: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db.voucher.count({ where }),
        ]);

        const mapped = vouchers.map((v: any) => ({
            id:          v.id,
            code:        v.code,
            plan:        v.package?.name,
            router:      v.router?.name || "",
            packageType: v.package?.type,
            status:      v.status.charAt(0) + v.status.slice(1).toLowerCase(),
            createdBy:   v.createdBy?.fullName || v.createdBy?.username || "System",
            createdAt:   toISOSafe(v.createdAt),
            timestamp:   toTimestampSafe(v.createdAt),
            usedBy:      v.usedBy,
            usedAt:      toISOSafe(v.usedAt),
            customer:    v.customer,
        }));

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        logger.error("[vouchers] GET failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/vouchers - single voucher creation
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "vouchers:create");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const body = await req.json();
        const parsed = VoucherCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { code, packageId, routerId, createdById } = parsed.data;

        if (!packageId) return errorResponse("packageId is required");

        let pkg = await db.package.findUnique({ where: { id: packageId } });
        if (!pkg) pkg = await db.package.findFirst({ where: { name: packageId } });
        if (!pkg) return errorResponse("Package not found", 404);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";

        if (!isSuperAdmin && pkg.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden: Package belongs to another tenant", 403);
        }

        const normalizedRouterId = routerId ? String(routerId).trim() : "";
        const routerIdValue = normalizedRouterId ? normalizedRouterId : null;

        if (routerIdValue) {
            const router = await db.router.findUnique({ where: { id: routerIdValue } });
            if (!router) return errorResponse("Router not found", 404);
            if (!isSuperAdmin && router.tenantId !== userPayload.tenantId) {
                return errorResponse("Forbidden: Router belongs to another tenant", 403);
            }
        }

        const { filter: tenantFilter } = getTenantFilter(userPayload);
        let finalCreatedById = userPayload?.userId || createdById;
        if (!finalCreatedById) {
            const admin = await db.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
            finalCreatedById = admin?.id;
        }

        if (!finalCreatedById) return errorResponse("Creator user ID is required");

        // HIGH-SEC FIX: Math.random() → crypto.randomBytes() + rejection-sampling.
        // Math.random() is NOT a CSPRNG — codes are predictable and brute-forceable.
        const finalCode = code || generateVoucherCode();
        const tenantIdValue = isSuperAdmin ? pkg.tenantId : userPayload.tenantId;

        // Ensure code is unique for friendly error message
        const exists = await db.voucher.findFirst({ where: { code: finalCode, tenantId: tenantIdValue } });
        if (exists) return errorResponse("Voucher code already exists", 409);

        const voucher = await db.voucher.create({
            data: {
                code:        finalCode,
                packageId:   pkg.id,
                routerId:    routerIdValue,
                createdById: finalCreatedById,
                tenantId:    tenantIdValue,
            },
        });

        return jsonResponse(voucher, 201);
    } catch (e: any) {
        logger.error("[vouchers] POST failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
