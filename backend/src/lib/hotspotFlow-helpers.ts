/**
 * Hotspot Portal Flow Helpers
 * 
 * Extracted common patterns from:
 * - Voucher redemption flow
 * - Payment purchase flow
 * - Subscription creation flow
 * - Payment webhook completion
 *
 * DUP-FIX-001: Centralizes RADIUS sync logic
 * DUP-FIX-002: Centralizes client creation logic
 * DUP-FIX-003: Centralizes rate limit calculation
 */

import { getTenantClient } from '@/lib/tenantPrisma';
import { enqueueRadiusSyncUser } from '@/lib/radius-queue';
import logger from '@/lib/logger';

// ── Rate Limit Calculation ────────────────────────────────────────────────────

/**
 * Calculate RADIUS rate limit from package upload/download speeds.
 * Format: "uploadSpeed uploadUnit / downloadSpeed downloadUnit"
 * Example: "10M/20M" or "512k/1024k"
 */
export function buildRadiusRateLimit(pkg: {
  uploadSpeed?: number | null;
  uploadUnit?: string | null;
  downloadSpeed?: number | null;
  downloadUnit?: string | null;
}): string | undefined {
  if (!pkg.uploadSpeed || !pkg.downloadSpeed) {
    return undefined;
  }

  const upUnit = pkg.uploadUnit?.charAt(0)?.toUpperCase() || 'M';
  const downUnit = pkg.downloadUnit?.charAt(0)?.toUpperCase() || 'M';

  return `${pkg.uploadSpeed}${upUnit}/${pkg.downloadSpeed}${downUnit}`;
}

// ── Client Creation ───────────────────────────────────────────────────────────

export interface CreateOrFindClientOptions {
  tenantId: string;
  phone?: string | null;
  macAddress?: string | null;
  lookupByPhone?: boolean;
  lookupByMac?: boolean;
}

export interface ClientLookupResult {
  client: any;
  isNew: boolean;
}

/**
 * Find or create a client by phone and/or MAC address.
 * 
 * E14 FIX: Splits phone/MAC lookups sequentially.
 * A single OR query could merge clients who share a MAC (e.g., resold device).
 * Phone is primary identifier; MAC is fallback only.
 */
export async function findOrCreateHotspotClient(
  options: CreateOrFindClientOptions
): Promise<ClientLookupResult> {
  const {
    tenantId,
    phone,
    macAddress,
    lookupByPhone = true,
    lookupByMac = true,
  } = options;

  const db = getTenantClient(tenantId);

  // 1. Try phone first (primary identifier)
  if (lookupByPhone && phone) {
    const existing = await db.client.findFirst({
      where: {
        tenantId,
        phone,
        subscriptions: {
          some: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        },
      },
    });
    if (existing) {
      // Update MAC if provided and different
      if (macAddress && existing.macAddress !== macAddress) {
        await db.client.update({
          where: { id: existing.id },
          data: { macAddress },
        });
      }
      return { client: existing, isNew: false };
    }
  }

  // 2. Try MAC as fallback (secondary identifier)
  if (lookupByMac && macAddress) {
    const existing = await db.client.findFirst({
      where: {
        tenantId,
        macAddress,
        subscriptions: {
          some: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        },
      },
    });
    if (existing) {
      return { client: existing, isNew: false };
    }
  }

  // 3. Create new client
  const username = `HS-${(phone || macAddress || '').slice(-10).replace(/\D/g, '')}`.slice(0, 20);
  let finalUsername = username;
  let suffix = 1;

  while (await db.client.findFirst({ where: { username: finalUsername, tenantId } })) {
    finalUsername = `${username}-${suffix}`;
    suffix++;
  }

  const newClient = await db.client.create({
    data: {
      username: finalUsername,
      fullName: `Hotspot ${phone || macAddress || 'User'}`,
      phone: phone || '0000000000',
      serviceType: 'HOTSPOT',
      status: 'ACTIVE',
      macAddress: macAddress || null,
      tenantId,
    },
  });

  return { client: newClient, isNew: true };
}

// ── RADIUS Sync (Non-blocking) ────────────────────────────────────────────────

export interface RadiusSyncOptions {
  client: any;
  package: any;
  password?: string; // varies: code (voucher), phone (payment), auto-generated (subscription)
  expiresAt?: Date;
  rateLimit?: string;
  tenantId: string | null;
  idempotencyKey?: string;
}

/**
 * Enqueue a RADIUS user sync operation (non-blocking).
 * Returns immediately; RADIUS sync happens in background worker.
 * 
 * DUP-FIX-001: Replaces inline syncRadiusUser() calls in:
 * - /api/subscriptions (POST)
 * - /api/hotspot/voucher/redeem (POST)
 * - /api/hotspot/purchase (POST)
 * - /api/invoices/[id]/pay (POST)
 * - payment completion webhook
 */
export async function enqueueRadiusSync(options: RadiusSyncOptions): Promise<void> {
  const {
    client,
    package: pkg,
    password,
    expiresAt,
    rateLimit,
    tenantId,
    idempotencyKey,
  } = options;

  try {
    await enqueueRadiusSyncUser(
      {
        username: client.username,
        password: password || undefined,
        tenantId: tenantId || null,
        fullName: client.fullName || undefined,
        expiresAt: expiresAt || undefined,
        status: 'Active',
        rateLimit: rateLimit || undefined,
        profileName: pkg.name || undefined,
      },
      idempotencyKey
    );

    logger.info('[HotspotFlow] RADIUS sync queued', {
      username: client.username,
      tenantId,
      packageName: pkg.name,
    });
  } catch (err) {
    logger.error('[HotspotFlow] Failed to enqueue RADIUS sync', {
      error: err instanceof Error ? err.message : String(err),
      username: client.username,
      tenantId,
    });
    throw err;
  }
}

// ── Subscription Expiration Calculation ────────────────────────────────────────

/**
 * Calculate subscription expiration date based on package duration.
 */
export function calculateExpirationDate(pkg: {
  duration: number;
  durationUnit: 'MINUTES' | 'HOURS' | 'DAYS' | 'MONTHS';
}): Date {
  const now = new Date();

  switch (pkg.durationUnit) {
    case 'MINUTES':
      now.setMinutes(now.getMinutes() + pkg.duration);
      break;
    case 'HOURS':
      now.setHours(now.getHours() + pkg.duration);
      break;
    case 'DAYS':
      now.setDate(now.getDate() + pkg.duration);
      break;
    case 'MONTHS':
      now.setMonth(now.getMonth() + pkg.duration);
      break;
    default:
      break;
  }

  return now;
}

// ── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Validate package readiness for activation.
 * Ensures package has all required fields for RADIUS/MikroTik.
 */
export function validatePackageForActivation(pkg: any): {
  valid: boolean;
  error?: string;
} {
  if (!pkg) {
    return { valid: false, error: 'Package not found' };
  }
  if (pkg.status !== 'ACTIVE') {
    return { valid: false, error: `Package is ${pkg.status.toLowerCase()}` };
  }
  if (!pkg.name) {
    return { valid: false, error: 'Package name is missing' };
  }
  if (!pkg.duration || !pkg.durationUnit) {
    return { valid: false, error: 'Package duration is incomplete' };
  }

  return { valid: true };
}

/**
 * Validate client readiness for activation.
 */
export function validateClientForActivation(client: any): {
  valid: boolean;
  error?: string;
} {
  if (!client) {
    return { valid: false, error: 'Client not found' };
  }
  if (!client.username) {
    return { valid: false, error: 'Client username is missing' };
  }
  if (client.status !== 'ACTIVE') {
    return { valid: false, error: `Client is ${client.status.toLowerCase()}` };
  }

  return { valid: true };
}
