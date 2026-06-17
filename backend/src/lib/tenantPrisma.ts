/**
 * MT-001: Prisma tenant-scoped client factory using $extends
 *
 * Creates a Prisma client extension that automatically injects `tenantId`
 * into WHERE clauses for all find/update/delete operations on tenant-scoped
 * models, eliminating the risk of cross-tenant data leakage from a forgotten
 * tenantFilter in a route handler.
 *
 * USAGE in route handlers:
 *   import { getTenantClient } from '@/lib/tenantPrisma';
 *
 *   const db = getTenantClient(userPayload.tenantId);
 *   // All queries below are automatically scoped to this tenant:
 *   const clients = await db.client.findMany();        // WHERE tenantId = ?
 *   const sub     = await db.subscription.findFirst(…); // WHERE tenantId = ?
 *
 * SUPER_ADMIN bypass:
 *   Pass null as tenantId to get an unscoped client (full cross-tenant access):
 *   const db = getTenantClient(null);  // no automatic tenantId filter
 *
 * ARCHITECTURE:
 *   - Built on Prisma's $extends (Component Extensions API), stable since 5.0
 *   - The base prisma instance (singleton pool) is reused — no extra connections
 *   - The extension object is cheap to create per-request (no I/O)
 *   - Works alongside existing raw $executeRaw / $queryRaw calls (not intercepted)
 *   - Soft-delete filtering (deletedAt IS NULL) is also applied here, replacing
 *     the need for the old softDelete middleware
 *
 * TENANT-SCOPED MODELS:
 *   Models that carry a tenantId column. Extend this list when adding new models.
 */

import prisma from './prisma';
import { Prisma } from '../generated/prisma';

// ── Tenant-scoped model names ─────────────────────────────────────────────────
// Must match Prisma model names exactly (camelCase).
const TENANT_MODELS = new Set([
    'client',
    'subscription',
    'transaction',
    'package',
    'router',
    'voucher',
    'radAcct',
    'radCheck',
    'radReply',
    'radGroupCheck',
    'radGroupReply',
    'radUserGroup',
    'radiusUser',
    'smsMessage',
    'userOtp',
    'auditLog',
    'expense',
    'invoice',
    'equipment',
    'paymentChannel',
    'tenantBranding',
    'tenantSettings',
    'tenantInvoice',
    'tenantPayment',
    'tenantPaymentGateway',
    'tenantLicense',
    'webhookLog',
    'user',
] as const);

// ── Soft-delete models (also have deletedAt) ──────────────────────────────────
const SOFT_DELETE_MODELS = new Set([
    'client',
    'subscription',
    'router',
    'package',
    'transaction',
    'user',
]);

// ── Extension factory ─────────────────────────────────────────────────────────

/**
 * Returns a Prisma client extension that auto-scopes queries to the given tenant.
 *
 * @param userOrTenantId - The user's JwtPayload, or a string tenantId, or null for unscoped access.
 */
export function getTenantClient(userOrTenantId: any | string | null) {
    let finalTenantId: string | null = null;

    if (userOrTenantId === undefined || userOrTenantId === null) {
        finalTenantId = null;
    } else if (typeof userOrTenantId === "object" && "role" in userOrTenantId) {
        // It's a JwtPayload
        const tenantId = userOrTenantId.tenantId ?? userOrTenantId.tenant_id ?? null;
        const isPlatformSuperAdmin = userOrTenantId.role === "SUPER_ADMIN" && !tenantId;
        finalTenantId = isPlatformSuperAdmin ? null : tenantId;
    } else {
        // It's a raw string
        finalTenantId = userOrTenantId as string;
    }

    return prisma.$extends({
        name: `tenant-scope:${finalTenantId ?? 'global'}`,
        query: {
            $allModels: {
                async findMany({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async findFirst({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async findFirstOrThrow({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async findUnique({ model, operation, args, query }: any) {
                    const isTenantModel = TENANT_MODELS.has(model as any);
                    const isSoftDeleted = SOFT_DELETE_MODELS.has(model as any);
                    if ((finalTenantId && isTenantModel) || isSoftDeleted) {
                        const newArgs = injectFilters(model, "findFirst", args, finalTenantId);
                        return (prisma as any)[model].findFirst(newArgs);
                    }
                    return query(args);
                },
                async update({ model, operation, args, query }: any) {
                    if (finalTenantId && TENANT_MODELS.has(model as any)) {
                        const checkArgs = injectFilters(model, "findFirst", { where: args.where }, finalTenantId);
                        const existing = await (prisma as any)[model].findFirst({ where: checkArgs.where, select: { tenantId: true } });
                        if (!existing) throw new Error(`Not Found or Unauthorized for ${model} update`);
                    }
                    return query(args);
                },
                async delete({ model, operation, args, query }: any) {
                    if (finalTenantId && TENANT_MODELS.has(model as any)) {
                        const checkArgs = injectFilters(model, "findFirst", { where: args.where }, finalTenantId);
                        const existing = await (prisma as any)[model].findFirst({ where: checkArgs.where, select: { tenantId: true } });
                        if (!existing) throw new Error(`Not Found or Unauthorized for ${model} delete`);
                    }
                    return query(args);
                },
                async count({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async aggregate({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async updateMany({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async deleteMany({ model, operation, args, query }: any) {
                    args = injectFilters(model, operation, args, finalTenantId);
                    return query(args);
                },
                async create({ model, operation, args, query }: any) {
                    // Auto-inject tenantId into data on create
                    if (finalTenantId && TENANT_MODELS.has(model as any) && args.data) {
                        args = {
                            ...args,
                            data: { ...args.data, tenantId: finalTenantId },
                        };
                    }
                    return query(args);
                },
                async createMany({ model, operation, args, query }: any) {
                    if (finalTenantId && TENANT_MODELS.has(model as any) && Array.isArray(args.data)) {
                        args = {
                            ...args,
                            data: args.data.map((row: any) => ({ ...row, tenantId: finalTenantId })),
                        };
                    }
                    return query(args);
                },
            },
        },
    });
}

// ── Helper: inject tenantId + soft-delete into WHERE ─────────────────────────

function injectFilters(
    model: string,
    _operation: string,
    args: any,
    tenantId: string | null,
): any {
    const isTenantModel = TENANT_MODELS.has(model as any);
    const isSoftDeleted = SOFT_DELETE_MODELS.has(model as any);
    const shouldScopeTenant = tenantId !== null && isTenantModel;
    const shouldFilterDeleted = isSoftDeleted;

    if (!shouldScopeTenant && !shouldFilterDeleted) return args;

    const additions: Record<string, any> = {};
    if (shouldScopeTenant) additions.tenantId = tenantId;
    if (shouldFilterDeleted) additions.deletedAt = null;

    return {
        ...args,
        where: {
            ...additions,
            ...(args?.where ?? {}),
            // Ensure tenant filter always wins if already present (belt-and-suspenders)
            ...(shouldScopeTenant ? { tenantId } : {}),
        },
    };
}

// ── Type export ───────────────────────────────────────────────────────────────
// Infer the extended client type so callers get full TS autocomplete.
export type TenantClient = ReturnType<typeof getTenantClient>;
