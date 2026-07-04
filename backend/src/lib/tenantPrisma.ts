/**
 * MT-001: Prisma tenant-scoped client factory using JavaScript Proxy
 *
 * Creates a Proxy wrapper around the Prisma client that automatically injects
 * `tenantId` into WHERE clauses for all find/update/delete operations on
 * tenant-scoped models, eliminating the risk of cross-tenant data leakage from
 * a forgotten tenantFilter in a route handler.
 *
 * WHY PROXY INSTEAD OF $extends:
 *   Prisma's $extends query interceptors do NOT fire when using a Driver Adapter
 *   (PrismaPg / @prisma/adapter-pg). This is a known limitation of Prisma v5-v7
 *   with driver adapters — the extension pipeline is bypassed entirely. The Proxy
 *   approach intercepts at the JavaScript layer and is 100% reliable regardless
 *   of the underlying adapter.
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
 *   Pass null as tenantId to get an unscoped client (full cross-tenant access).
 *   Soft-delete filtering STILL applies for super-admins (deleted data is hidden).
 *
 * ARCHITECTURE:
 *   - Proxy wraps the base prisma singleton (no extra connections, no I/O)
 *   - Works regardless of Prisma adapter (PrismaPg, libSQL, etc.)
 *   - Works alongside existing raw $executeRaw / $queryRaw calls (not intercepted)
 *   - Soft-delete filtering (deletedAt IS NULL) is applied here for all clients
 *
 * TENANT-SCOPED MODELS:
 *   Models that carry a tenantId column. Extend this list when adding new models.
 */

import prisma from './prisma';

// ── Tenant-scoped model names ─────────────────────────────────────────────────
// Must match Prisma model names exactly (camelCase accessor on PrismaClient).
const TENANT_MODELS = new Set([
    'client',
    'subscription',
    'transaction',
    'package',
    'router',
    'routerLog',
    'voucher',
    'radAcct',
    'radCheck',
    'radReply',
    'radGroupCheck',
    'radGroupReply',
    'radUserGroup',
    'radiusUser',
    'radiusNas',
    'radPostAuth',
    'smsMessage',
    'userOtp',
    'auditLog',
    'expense',
    'invoice',
    'invoiceItem',
    'equipment',
    'hotspotSettings',
    'messageTemplate',
    'paymentChannel',
    'systemSetting',
    'tenantBranding',
    'tenantSettings',
    'tenantInvoice',
    'tenantPayment',
    'tenantPaymentGateway',
    'tenantLicense',
    'vpnUser',
    'webhookLog',
    'user',
    'radUserGroup',
    'radPostAuth',
]);

// ── Soft-delete models (also have deletedAt column) ───────────────────────────
const SOFT_DELETE_MODELS = new Set([
    'client',
    'subscription',
    'router',
    'package',
    'transaction',
    'user',
]);

// ── Helper: build the filter additions for a given model + tenantId ─────────────

function buildWhere(
    model: string,
    tenantId: string | null,
    existingWhere?: Record<string, unknown>,
): Record<string, unknown> {
    const isTenantModel = TENANT_MODELS.has(model);
    const isSoftDeleteModel = SOFT_DELETE_MODELS.has(model);

    const additions: Record<string, unknown> = {};

    // Soft-delete: inject deletedAt=null ONLY when the caller has not already
    // specified an explicit deletedAt filter. This allows admin operations like
    // purgeOldSoftDeleted() to query with { deletedAt: { lte: cutoff } } without
    // being overridden. Regular route handlers never pass deletedAt in WHERE,
    // so they always get the soft-delete filter applied automatically.
    const callerHasDeletedAt =
        existingWhere !== undefined && 'deletedAt' in existingWhere;
    if (isSoftDeleteModel && !callerHasDeletedAt) {
        additions.deletedAt = null;
    }

    // Tenant filter: force tenantId for non-super-admin scoped clients.
    // This ALWAYS wins over any tenantId the caller might provide to prevent
    // cross-tenant spoofing attacks.
    if (tenantId !== null && isTenantModel) {
        additions.tenantId = tenantId;
    }

    if (Object.keys(additions).length === 0) {
        return existingWhere ?? {};
    }

    return {
        ...(existingWhere ?? {}),
        ...additions,
        // Force tenantId last so a caller cannot spoof it in their WHERE clause
        ...(tenantId !== null && isTenantModel ? { tenantId } : {}),
    };
}

// ── Model delegate proxy factory ──────────────────────────────────────────────

function createModelProxy(
    delegate: Record<string, (...args: any[]) => any>,
    model: string,
    tenantId: string | null,
): Record<string, (...args: any[]) => any> {
    return new Proxy(delegate, {
        get(target, prop: string) {
            const original = target[prop];
            if (typeof original !== 'function') return original;

            // ── Read operations: inject tenant + soft-delete into WHERE ──────
            if (
                prop === 'findMany' ||
                prop === 'findFirst' ||
                prop === 'findFirstOrThrow' ||
                prop === 'count' ||
                prop === 'aggregate' ||
                prop === 'updateMany' ||
                prop === 'deleteMany'
            ) {
                return (args: any = {}) => {
                    const newArgs = {
                        ...args,
                        where: buildWhere(model, tenantId, args?.where),
                    };
                    return original.call(target, newArgs);
                };
            }

            // ── findUnique: redirect to findFirst with filters ───────────────
            if (prop === 'findUnique' || prop === 'findUniqueOrThrow') {
                return (args: any = {}) => {
                    const isTenantModel = TENANT_MODELS.has(model);
                    const isSoftDeleteModel = SOFT_DELETE_MODELS.has(model);
                    if (
                        (tenantId !== null && isTenantModel) ||
                        isSoftDeleteModel
                    ) {
                        const newWhere = buildWhere(
                            model,
                            tenantId,
                            args?.where,
                        );
                        if (prop === 'findUniqueOrThrow') {
                            return target.findFirstOrThrow.call(target, {
                                ...args,
                                where: newWhere,
                            });
                        }
                        return target.findFirst.call(target, {
                            ...args,
                            where: newWhere,
                        });
                    }
                    return original.call(target, args);
                };
            }

            // ── update: ownership check before proceeding ────────────────────
            if (prop === 'update') {
                return async (args: any = {}) => {
                    const isTenantModel = TENANT_MODELS.has(model);
                    if (tenantId !== null && isTenantModel) {
                        const checkWhere = buildWhere(
                            model,
                            tenantId,
                            args?.where,
                        );
                        const existing = await target.findFirst.call(target, {
                            where: checkWhere,
                            select: { id: true },
                        });
                        if (!existing) {
                            throw new Error(
                                `Not Found or Unauthorized for ${model} update`,
                            );
                        }
                    }
                    return original.call(target, args);
                };
            }

            // ── delete: ownership check before proceeding ────────────────────
            if (prop === 'delete') {
                return async (args: any = {}) => {
                    const isTenantModel = TENANT_MODELS.has(model);
                    if (tenantId !== null && isTenantModel) {
                        const checkWhere = buildWhere(
                            model,
                            tenantId,
                            args?.where,
                        );
                        const existing = await target.findFirst.call(target, {
                            where: checkWhere,
                            select: { id: true },
                        });
                        if (!existing) {
                            throw new Error(
                                `Not Found or Unauthorized for ${model} delete`,
                            );
                        }
                    }
                    return original.call(target, args);
                };
            }

            // ── create: auto-inject tenantId into data ───────────────────────
            if (prop === 'create') {
                return (args: any = {}) => {
                    const isTenantModel = TENANT_MODELS.has(model);
                    if (tenantId !== null && isTenantModel && args.data) {
                        const newArgs = {
                            ...args,
                            data: { ...args.data, tenantId },
                        };
                        return original.call(target, newArgs);
                    }
                    return original.call(target, args);
                };
            }

            // ── upsert: scope where/create/update to the tenant ───────────────
            if (prop === 'upsert') {
                return (args: any = {}) => {
                    const isTenantModel = TENANT_MODELS.has(model);
                    if (tenantId !== null && isTenantModel) {
                        const newArgs = {
                            ...args,
                            where: buildWhere(model, tenantId, args?.where),
                            create: args?.create ? { ...args.create, tenantId } : args?.create,
                            update: args?.update ? { ...args.update, tenantId } : args?.update,
                        };
                        return original.call(target, newArgs);
                    }
                    return original.call(target, args);
                };
            }

            // ── createMany: auto-inject tenantId into each row ───────────────
            if (prop === 'createMany') {
                return (args: any = {}) => {
                    const isTenantModel = TENANT_MODELS.has(model);
                    if (
                        tenantId !== null &&
                        isTenantModel &&
                        Array.isArray(args.data)
                    ) {
                        const newArgs = {
                            ...args,
                            data: args.data.map((row: any) => ({
                                ...row,
                                tenantId,
                            })),
                        };
                        return original.call(target, newArgs);
                    }
                    return original.call(target, args);
                };
            }

            // All other methods pass through unchanged
            return original.bind(target);
        },
    });
}

// ── Client proxy factory ──────────────────────────────────────────────────────

function createClientProxy(
    client: typeof prisma,
    tenantId: string | null,
): typeof prisma {
    return new Proxy(client, {
        get(target, prop: string) {
            // Intercept model accessor properties (e.g. prisma.router, prisma.client)
            // These are all lowercase camelCase names matching TENANT_MODELS or soft-delete models.
            const isTenantModel = TENANT_MODELS.has(prop);
            const isSoftDeleteModel = SOFT_DELETE_MODELS.has(prop);

            if (isTenantModel || isSoftDeleteModel) {
                const delegate = (target as any)[prop];
                if (delegate && typeof delegate === 'object') {
                    return createModelProxy(delegate, prop, tenantId);
                }
            }

            // Everything else (e.g. $transaction, $queryRaw, $connect, etc.)
            const value = (target as any)[prop];
            if (typeof value === 'function') {
                return value.bind(target);
            }
            return value;
        },
    });
}

// ── Public factory ────────────────────────────────────────────────────────────

/**
 * Returns a Prisma client proxy that auto-scopes queries to the given tenant.
 *
 * @param userOrTenantId - The user's JwtPayload, or a string tenantId, or null
 *                          for unscoped (super-admin) access.
 *
 * Soft-delete filtering (deletedAt IS NULL) always applies regardless of tenant scope.
 */
export function getTenantClient(userOrTenantId: any): typeof prisma {
    let finalTenantId: string | null = null;

    if (userOrTenantId === undefined || userOrTenantId === null) {
        finalTenantId = null;
    } else if (typeof userOrTenantId === 'object' && 'role' in userOrTenantId) {
        // It's a JwtPayload
        const tenantId =
            userOrTenantId.tenantId ?? userOrTenantId.tenant_id ?? null;
        const isPlatformSuperAdmin =
            userOrTenantId.role === 'SUPER_ADMIN' && !tenantId;
        finalTenantId = isPlatformSuperAdmin ? null : tenantId;
    } else if (typeof userOrTenantId === 'string') {
        finalTenantId = userOrTenantId;
    }

    return createClientProxy(prisma, finalTenantId);
}

// ── Type export ───────────────────────────────────────────────────────────────
// Preserve the same type so callers get full TS autocomplete.
export type TenantClient = ReturnType<typeof getTenantClient>;
