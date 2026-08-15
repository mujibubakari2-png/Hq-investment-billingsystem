/**
 * Distributed Router Lock (Redis Mutex)
 *
 * ENTERPRISE-001: Prevents concurrent provisioning of the same router.
 *
 * Uses Redis SET NX EX (atomic) to acquire a per-router mutex.
 * If a lock is already held, the caller receives null immediately —
 * it is the caller's responsibility to handle contention (queue, reject, or retry).
 *
 * Usage:
 *   const lock = await acquireRouterLock(routerId, 'provision', 120);
 *   if (!lock) throw new Error('Router is already being provisioned');
 *   try { ... } finally { await lock.release(); }
 *
 * Properties:
 *   - Atomic: SET NX EX — no race condition
 *   - Self-expiring: lock expires even if process crashes
 *   - Token-based: only the holder can release (random token prevents accidental release)
 *   - Heartbeat: caller can extend TTL while working
 */

import { getRedisConnection } from "./queue";
import logger from "@/lib/logger";
import { randomBytes } from "crypto";

// Lock TTL constants
const DEFAULT_TTL_SECONDS = 120;          // 2 min default
const PROVISION_TTL_SECONDS = 300;        // 5 min for provisioning
const DISCOVERY_TTL_SECONDS = 60;         // 1 min for discovery
const HEARTBEAT_INTERVAL_MS = 30_000;     // renew every 30s

export type LockOperation = "provision" | "discovery" | "backup" | "firmware" | "custom";

export interface RouterLock {
    routerId: string;
    operation: LockOperation;
    token: string;
    expiresAt: Date;
    /** Extend the lock TTL while still working */
    renew(additionalSeconds?: number): Promise<boolean>;
    /** Release the lock — MUST be called in finally block */
    release(): Promise<void>;
}

function lockKey(routerId: string, operation: LockOperation): string {
    return `router:lock:${operation}:${routerId}`;
}

function ttlFor(operation: LockOperation): number {
    switch (operation) {
        case "provision": return PROVISION_TTL_SECONDS;
        case "discovery": return DISCOVERY_TTL_SECONDS;
        default:          return DEFAULT_TTL_SECONDS;
    }
}

/**
 * Attempt to acquire a distributed lock on a router.
 * Returns null immediately if the lock is already held.
 */
export async function acquireRouterLock(
    routerId: string,
    operation: LockOperation,
    ttlSeconds?: number
): Promise<RouterLock | null> {
    const redis = getRedisConnection();
    const key = lockKey(routerId, operation);
    const token = randomBytes(16).toString("hex");
    const ttl = ttlSeconds ?? ttlFor(operation);

    // Atomic: SET key token NX EX ttl
    const acquired = await (redis as any).set(key, token, "NX", "EX", ttl);
    if (!acquired) {
        logger.warn(`[DistributedLock] Router ${routerId} already locked for ${operation}`);
        return null;
    }

    const expiresAt = new Date(Date.now() + ttl * 1000);
    logger.debug(`[DistributedLock] Acquired lock: ${key} (token=${token.slice(0, 8)}…, ttl=${ttl}s)`);

    return {
        routerId,
        operation,
        token,
        expiresAt,

        async renew(additionalSeconds = ttl): Promise<boolean> {
            // Lua: only renew if token matches (prevent accidental renewal of another lock)
            const script = `
                if redis.call("GET", KEYS[1]) == ARGV[1] then
                    return redis.call("EXPIRE", KEYS[1], ARGV[2])
                else
                    return 0
                end
            `;
            try {
                const result = await (redis as any).eval(script, 1, key, token, additionalSeconds);
                if (result === 1) {
                    logger.debug(`[DistributedLock] Renewed lock: ${key} (+${additionalSeconds}s)`);
                    return true;
                }
                logger.warn(`[DistributedLock] Renew failed — token mismatch or key expired: ${key}`);
                return false;
            } catch (e) {
                logger.warn(`[DistributedLock] Renew error: ${e}`);
                return false;
            }
        },

        async release(): Promise<void> {
            // Lua: only delete if token matches (prevents releasing another holder's lock)
            const script = `
                if redis.call("GET", KEYS[1]) == ARGV[1] then
                    return redis.call("DEL", KEYS[1])
                else
                    return 0
                end
            `;
            try {
                const result = await (redis as any).eval(script, 1, key, token);
                if (result === 1) {
                    logger.debug(`[DistributedLock] Released lock: ${key}`);
                } else {
                    logger.warn(`[DistributedLock] Lock already expired or taken: ${key}`);
                }
            } catch (e) {
                logger.error(`[DistributedLock] Release error: ${e}`);
            }
        },
    };
}

/**
 * Check if a router is currently locked for a given operation.
 * Used to show "Provisioning in progress" UI state.
 */
export async function isRouterLocked(routerId: string, operation: LockOperation): Promise<boolean> {
    const redis = getRedisConnection();
    const val = await (redis as any).get(lockKey(routerId, operation));
    return val !== null;
}

/**
 * Force-release a lock (admin/recovery use only — use with caution).
 * Should only be called after confirming the holder is dead.
 */
export async function forceReleaseRouterLock(
    routerId: string,
    operation: LockOperation
): Promise<void> {
    const redis = getRedisConnection();
    await (redis as any).del(lockKey(routerId, operation));
    logger.warn(`[DistributedLock] Force-released lock for router ${routerId} (op=${operation})`);
}

/**
 * Start a heartbeat that renews a lock periodically while a long operation runs.
 * Returns a stop function — call it in finally to clear the interval.
 */
export function startLockHeartbeat(lock: RouterLock, intervalMs = HEARTBEAT_INTERVAL_MS): () => void {
    const timer = setInterval(async () => {
        const ok = await lock.renew();
        if (!ok) {
            logger.error(`[LockHeartbeat] Failed to renew lock for router ${lock.routerId} — operation may be interrupted`);
        }
    }, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
}
