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
 *   await softDelete('client', id);
 *
 *   // Restore a soft-deleted record
 *   await restore('client', id);
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
 */
export async function softDelete(
  model: SoftDeletableModel,
  id: string
): Promise<{ id: string; deletedAt: Date | null } | null> {
  const now = new Date();

  const db = getTenantClient(null);
  // Prisma's dynamic model access requires type assertion
  const delegate = (db as any)[model];
  if (!delegate?.update) {
    throw new Error(`Soft delete not supported for model: ${model}`);
  }

  try {
    return await delegate.update({
      where: { id },
      data: { deletedAt: now },
      select: { id: true, deletedAt: true },
    });
  } catch (err: any) {
    // P2025 = record not found
    if (err?.code === 'P2025') return null;
    throw err;
  }
}

/**
 * Restore a soft-deleted record by clearing deletedAt.
 */
export async function restore(
  model: SoftDeletableModel,
  id: string
): Promise<{ id: string; deletedAt: Date | null } | null> {
  const db = getTenantClient(null);
  const delegate = (db as any)[model];
  if (!delegate?.update) {
    throw new Error(`Restore not supported for model: ${model}`);
  }

  try {
    return await delegate.update({
      where: { id },
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
 * @param daysOld  Records deleted more than this many days ago will be purged. Default: 90.
 */
export async function purgeOldSoftDeleted(daysOld = 90): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const db = getTenantClient(null);
  const [clients, users, subscriptions, routers, packages, transactions] = await Promise.all([
    db.client.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    db.user.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    db.subscription.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    db.router.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    db.package.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    db.transaction.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
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
