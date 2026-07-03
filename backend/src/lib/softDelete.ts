/**
 * Soft Delete Utility
 *
 * CRIT-005 FIX: Provides safe deletion that sets deletedAt instead of
 * permanently removing records. Prevents accidental unrecoverable data loss.
 *
 * Models that support soft delete (have `deletedAt DateTime?` field):
 *   - Client
 *   - User
 *   - Subscription
 *   - Router
 *   - Package
 *   - Transaction
 *
 * Usage:
 *   import { softDelete, restore, isSoftDeleted } from '@/lib/softDelete';
 *
 *   // Instead of: await prisma.client.delete({ where: { id } })
 *   await softDelete('client', id, tenantId);
 *
 *   // Restore a soft-deleted record
 *   await restore('client', id, tenantId);
 */

import { getTenantClient } from '@/lib/tenantPrisma';

export type SoftDeletableModel =
  | 'client'
  | 'user'
  | 'subscription'
  | 'router'
  | 'package'
  | 'transaction';

/**
 * Soft delete a record by setting deletedAt to now().
 * Returns the updated record or null if not found.
 *
 * CRIT-D-001 FIX: tenantId is now REQUIRED. The where clause is always
 * scoped to the caller's tenant, preventing cross-tenant record manipulation.
 */
export async function softDelete(
  model: SoftDeletableModel,
  id: string,
  tenantId: string   // REQUIRED — never omit; prevents cross-tenant writes
): Promise<{ id: string; deletedAt: Date | null } | null> {
  const now = new Date();

  // getTenantClient scopes all queries to this tenantId automatically.
  const db = getTenantClient({ tenantId } as any);
  const delegate = (db as any)[model];
  if (!delegate?.update) {
    throw new Error(`Soft delete not supported for model: ${model}`);
  }

  try {
    return await delegate.update({
      where: { id, tenantId },   // explicit tenantId enforces tenant isolation
      data: { deletedAt: now },
      select: { id: true, deletedAt: true },
    });
  } catch (err: any) {
    // P2025 = record not found (wrong tenant or nonexistent)
    if (err?.code === 'P2025') return null;
    throw err;
  }
}

/**
 * Restore a soft-deleted record by clearing deletedAt.
 *
 * CRIT-D-001 FIX: tenantId is now REQUIRED.
 */
export async function restore(
  model: SoftDeletableModel,
  id: string,
  tenantId: string   // REQUIRED
): Promise<{ id: string; deletedAt: Date | null } | null> {
  const db = getTenantClient({ tenantId } as any);
  const delegate = (db as any)[model];
  if (!delegate?.update) {
    throw new Error(`Restore not supported for model: ${model}`);
  }

  try {
    return await delegate.update({
      where: { id, tenantId },
      data: { deletedAt: null },
      select: { id: true, deletedAt: true },
    });
  } catch (err: any) {
    if (err?.code === 'P2025') return null;
    throw err;
  }
}

/**
 * Check if a record is soft-deleted.
 */
export function isSoftDeleted(record: { deletedAt?: Date | null }): boolean {
  return record.deletedAt !== null && record.deletedAt !== undefined;
}

/**
 * Helper: Prisma `where` clause fragment to exclude soft-deleted records.
 * Use this in any findMany / findFirst where you want to exclude deleted records.
 *
 * Example:
 *   await prisma.client.findMany({
 *     where: { tenantId, ...notDeleted() }
 *   })
 */
export function notDeleted(): { deletedAt: null } {
  return { deletedAt: null };
}

/**
 * Helper: Only fetch soft-deleted records (for admin restore interfaces).
 */
export function onlyDeleted(): { deletedAt: { not: null } } {
  return { deletedAt: { not: null } };
}

/**
 * Permanently purge records that were soft-deleted more than N days ago.
 * Call from a scheduled cron job (e.g., weekly).
 *
 * HIGH-D-002 FIX: tenantId is now accepted as an optional parameter.
 * When provided, only that tenant's records are purged. When omitted,
 * the function purges across all tenants (platform-admin use only).
 *
 * @param daysOld   Records deleted more than this many days ago will be purged. Default: 90.
 * @param tenantId  Optional tenant scope. Omit only from platform-admin cron jobs.
 */
export async function purgeOldSoftDeleted(
  daysOld = 90,
  tenantId?: string
): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const tenantScope = tenantId ? { tenantId } : {};

  const db = getTenantClient(null);
  const [clients, users, subscriptions, routers, packages, transactions] = await Promise.all([
    db.client.deleteMany({ where: { deletedAt: { lte: cutoff }, ...tenantScope } }),
    db.user.deleteMany({ where: { deletedAt: { lte: cutoff }, ...tenantScope } }),
    db.subscription.deleteMany({ where: { deletedAt: { lte: cutoff }, ...tenantScope } }),
    db.router.deleteMany({ where: { deletedAt: { lte: cutoff }, ...tenantScope } }),
    db.package.deleteMany({ where: { deletedAt: { lte: cutoff }, ...tenantScope } }),
    db.transaction.deleteMany({ where: { deletedAt: { lte: cutoff }, ...tenantScope } }),
  ]);

  return {
    clients: clients.count,
    users: users.count,
    subscriptions: subscriptions.count,
    routers: routers.count,
    packages: packages.count,
    transactions: transactions.count,
  };
}
