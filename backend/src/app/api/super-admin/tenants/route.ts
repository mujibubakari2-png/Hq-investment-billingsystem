import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { sendAccountApprovedNotifications } from "@/lib/accountNotifications";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

/**
 * GET /api/super-admin/tenants
 * POST /api/super-admin/tenants
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * GET returns only PLATFORM-LEVEL tenant metadata:
 *   ✅ Tenant name, email, phone, status, planId, licenseExpiresAt
 *   ✅ Tenant's primary admin name/email (for contact purposes)
 *   ✅ License info
 *
 *   ❌ NO clients data
 *   ❌ NO router credentials
 *   ❌ NO transactions/revenue
 *   ❌ NO vouchers, subscriptions
 *   ❌ NO system settings of the tenant
 *
 * POST creates a new tenant with auto-generated admin credentials.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const planId = searchParams.get("planId") || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Prisma.TenantWhereInput = {};
        if (status) where.status = status as Prisma.EnumTenantStatusFilter<"Tenant">;
        if (planId) where.planId = planId;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
            ];
        }

        const [tenants, total] = await Promise.all([
            db.tenant.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    // PLATFORM METADATA ONLY — no operational data
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    slug: true,
                    status: true,
                    planId: true,
                    createdAt: true,
                    trialStart: true,
                    trialEnd: true,
                    licenseExpiresAt: true,
                    plan: { select: { name: true, price: true } },
                    // Only ADMIN user's contact info for reaching out — NOT operational data
                    users: {
                        where: { role: "ADMIN", deletedAt: null },
                        select: { fullName: true, email: true, phone: true },
                        take: 1,
                    },
                    tenantLicenses: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { status: true, startsAt: true, expiresAt: true },
                    },
                },
            }),
            db.tenant.count({ where }),
        ]);

        return jsonResponse({
            data: tenants.map((t) => ({
                id: t.id,
                name: t.name,
                email: t.email,
                phone: t.phone,
                slug: t.slug,
                status: t.status,
                planId: t.planId,
                planName: t.plan?.name,
                planPrice: t.plan?.price ? Number(t.plan.price) : null,
                createdAt: t.createdAt,
                trialStart: t.trialStart,
                trialEnd: t.trialEnd,
                licenseExpiresAt: t.licenseExpiresAt,
                primaryAdmin: t.users[0] ? {
                    fullName: t.users[0].fullName,
                    email: t.users[0].email,
                    phone: t.users[0].phone,
                } : null,
                latestLicense: t.tenantLicenses[0] || null,
            })),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (e) {
        logger.error("Super Admin GET Tenants Error:", { error: e instanceof Error ? e.message : String(e) });
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
        const { name, email, phone, planId, adminEmail, adminName, adminPhone } = body;

        if (!name || !email || !planId) {
            return errorResponse("name, email, and planId are required", 400);
        }

        const plan = await db.saasPlan.findUnique({ where: { id: planId } });
        if (!plan) return errorResponse("Plan not found", 404);

        const existing = await db.tenant.findUnique({ where: { email } });
        if (existing) return errorResponse("A tenant with this email already exists", 409);

        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const uniqueSlug = `${slug}-${Date.now().toString(36)}`;

        // Generate temporary admin password
        const tempPassword = `Admin@${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 900 + 100)}`;
        const hashedPassword = await hashPassword(tempPassword);

        // Create tenant + admin user in a transaction
        const tenant = await db.$transaction(async (tx) => {
            const newTenant = await tx.tenant.create({
                data: {
                    name,
                    email,
                    phone,
                    slug: uniqueSlug,
                    planId,
                    status: "PENDING_APPROVAL",
                },
            });

            // Create the tenant's admin user
            const adminUsername = `admin_${uniqueSlug.slice(0, 12)}`;
            await tx.user.create({
                data: {
                    username: adminUsername,
                    email: adminEmail || email,
                    fullName: adminName || `${name} Admin`,
                    phone: adminPhone || phone,
                    password: hashedPassword,
                    role: "SUPER_ADMIN",
                    tenantId: newTenant.id,
                    isPlatformAdmin: false,
                },
            });

            return newTenant;
        });

        // Audit log
        await writeAuditLog({
            tenantId: tenant.id,
            userId: guard.user.userId,
            action: "PLATFORM_CREATE_TENANT",
            resource: "Tenant",
            resourceId: tenant.id,
            details: { tenantName: name, planId, createdByPlatformAdmin: guard.user.userId },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        logger.info("Platform Super Admin created tenant", { tenantId: tenant.id, tenantName: name });

        return jsonResponse({
            message: `Tenant "${name}" created successfully. Status: PENDING_APPROVAL.`,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                email: tenant.email,
                slug: tenant.slug,
                status: tenant.status,
            },
            // Return temp credentials to super admin for handoff
            credentials: {
                adminEmail: adminEmail || email,
                tempPassword,
                note: "Please share these credentials securely with the tenant. They should change their password immediately.",
            },
        }, 201);
    } catch (e) {
        logger.error("Super Admin POST Tenant Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
