/**
 * Circuit Breaker — HIGH-R-004 FIX
 *
 * A Redis-backed circuit breaker that prevents cascading failures when
 * external services (MikroTik routers, payment providers, RADIUS) become
 * slow, unresponsive, or repeatedly fail.
 *
 * States:
 *   CLOSED   — Normal operation. Requests flow through.
 *   OPEN     — Service is broken. Requests are rejected immediately (fail-fast).
 *   HALF-OPEN — After the cool-down period, one request is allowed through to
 *               probe whether the service has recovered. On success → CLOSED.
 *               On failure → OPEN again.
 *
 * Why Redis?
 *   A single-process in-memory counter would not share state across PM2 workers.
 *   Using Redis ensures that when worker #1 trips a breaker for a router, workers
 *   #2–#5 also see it as OPEN and don't pile on.
 *
 * Fail-safe behaviour:
 *   If Redis itself is unavailable, the circuit breaker fails open (lets the
 *   request through) to avoid masking Redis outages as external service outages.
 *
 * Usage:
 *   import { withCircuitBreaker } from '@/lib/circuitBreaker';
 *
 *   // Protect a MikroTik call:
 *   const result = await withCircuitBreaker(
 *     `mikrotik:${routerId}`,       // unique name per circuit
 *     () => service.createPPPoEUser(routerId, username, password),
 *     { threshold: 5, windowSec: 60, halfOpenAfterSec: 30 }
 *   );
 *
 *   // Protect a payment provider call:
 *   const result = await withCircuitBreaker(
 *     `payment:zenopay:${tenantId}`,
 *     () => zenoPay.initiatePayment(params),
 *   );
 */

import { getRedisClient } from '@/lib/cache';
import logger from '@/lib/logger';

export interface CircuitBreakerOptions {
    /** Number of consecutive failures that trip the breaker to OPEN. Default: 5. */
    threshold?: number;
    /** Sliding window in seconds over which failures are counted. Default: 60. */
    windowSec?: number;
    /** How long (seconds) the breaker stays OPEN before testing half-open. Default: 30. */
    halfOpenAfterSec?: number;
}

const DEFAULTS: Required<CircuitBreakerOptions> = {
    threshold: 5,
    windowSec: 60,
    halfOpenAfterSec: 30,
};

/**
 * Execute `fn` inside a circuit breaker.
 *
 * @param name    Unique circuit identifier, e.g. `mikrotik:routerId` or `payment:zenopay`.
 * @param fn      The async operation to protect.
 * @param options Circuit breaker tuning parameters.
 * @throws  `CircuitBreakerOpenError` if the circuit is OPEN.
 * @throws  The original error from `fn` if the call fails (and increments the counter).
 */
export async function withCircuitBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    options: CircuitBreakerOptions = {},
): Promise<T> {
    const opts = { ...DEFAULTS, ...options };
    const redis = getRedisClient();

    if (!redis) {
        // Redis unavailable — bypass the breaker (fail-open) to avoid
        // treating a Redis outage as an external service outage.
        logger.warn('[CircuitBreaker] Redis unavailable, bypassing circuit breaker', { name });
        return fn();
    }

    const openKey  = `cb:open:${name}`;
    const failKey  = `cb:fail:${name}`;

    // ── Check breaker state ───────────────────────────────────────────────────
    try {
        const isOpen = await redis.exists(openKey);
        if (isOpen) {
            throw new CircuitBreakerOpenError(name);
        }
    } catch (checkErr) {
        if (checkErr instanceof CircuitBreakerOpenError) throw checkErr;
        // Redis error during state check — fail-open
        logger.warn('[CircuitBreaker] Redis error during state check, bypassing', {
            name,
            error: checkErr instanceof Error ? checkErr.message : String(checkErr),
        });
        return fn();
    }

    // ── Execute the guarded operation ────────────────────────────────────────
    try {
        const result = await fn();

        // Success: reset failure counter
        try { await redis.del(failKey); } catch { /* ignore Redis errors on reset */ }

        return result;
    } catch (fnErr) {
        // ── Record failure ────────────────────────────────────────────────────
        try {
            const failures = await redis.incr(failKey);
            if (failures === 1) {
                // Set TTL on the first failure to create a sliding window
                await redis.expire(failKey, opts.windowSec);
            }

            if (failures >= opts.threshold) {
                // Trip the breaker: mark OPEN with a TTL for half-open probe
                await redis.set(openKey, '1', 'EX', opts.halfOpenAfterSec);
                logger.error('[CircuitBreaker] OPENED — too many consecutive failures', {
                    name,
                    failures,
                    halfOpenAfterSec: opts.halfOpenAfterSec,
                });
                // Clean up the failure counter — the open key is now the authority
                await redis.del(failKey);
            } else {
                logger.warn('[CircuitBreaker] failure recorded', { name, failures, threshold: opts.threshold });
            }
        } catch (redisErr) {
            // Redis error during counter update — log but don't mask the real error
            logger.warn('[CircuitBreaker] Redis error during failure recording', {
                name,
                error: redisErr instanceof Error ? redisErr.message : String(redisErr),
            });
        }

        throw fnErr; // always re-throw the original error
    }
}

/**
 * Manually reset a circuit breaker (e.g. after confirming a service is healthy).
 */
export async function resetCircuitBreaker(name: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.del(`cb:open:${name}`, `cb:fail:${name}`);
        logger.info('[CircuitBreaker] Manually reset', { name });
    } catch (err: any) {
        logger.warn('[CircuitBreaker] Error resetting circuit breaker', { name, error: err.message });
    }
}

/**
 * Check the current state of a circuit breaker.
 * Returns 'open', 'closed', or 'unknown' (if Redis is unavailable).
 */
export async function getCircuitBreakerState(name: string): Promise<'open' | 'closed' | 'unknown'> {
    const redis = getRedisClient();
    if (!redis) return 'unknown';
    try {
        const isOpen = await redis.exists(`cb:open:${name}`);
        return isOpen ? 'open' : 'closed';
    } catch {
        return 'unknown';
    }
}

/**
 * Thrown when a circuit breaker is in OPEN state.
 * Callers should catch this to return a graceful degraded response.
 */
export class CircuitBreakerOpenError extends Error {
    public readonly circuitName: string;
    constructor(name: string) {
        super(`Circuit breaker OPEN for "${name}". Service temporarily unavailable.`);
        this.name = 'CircuitBreakerOpenError';
        this.circuitName = name;
    }
}
