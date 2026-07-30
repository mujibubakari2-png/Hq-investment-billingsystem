/**
 * Per-Router Circuit Breaker
 *
 * ENTERPRISE-002: Prevents overloading routers that are consistently failing.
 *
 * States:
 *   CLOSED     → normal operation, requests pass through
 *   OPEN       → circuit tripped, requests rejected immediately
 *   HALF_OPEN  → trial mode, one request allowed through to test recovery
 *
 * Transitions:
 *   CLOSED → OPEN     when failureCount ≥ threshold within window
 *   OPEN   → HALF_OPEN after resetTimeoutMs
 *   HALF_OPEN → CLOSED  on success
 *   HALF_OPEN → OPEN    on failure (back to full open)
 *
 * Stored in Redis so it persists across worker restarts.
 *
 * Usage:
 *   const cb = getCircuitBreaker(routerId);
 *   if (!await cb.canAttempt()) throw new Error('Circuit open for this router');
 *   try {
 *     const result = await someAdapterCall();
 *     await cb.recordSuccess();
 *     return result;
 *   } catch (err) {
 *     await cb.recordFailure();
 *     throw err;
 *   }
 */

import { getRedisConnection } from "./queue";
import logger from "@/lib/logger";

// ── Configuration ──────────────────────────────────────────────────────────────

const FAILURE_THRESHOLD = 5;              // failures before OPEN
const RESET_TIMEOUT_MS = 60_000;          // 1 min before trying HALF_OPEN
const SUCCESS_THRESHOLD = 2;             // successes in HALF_OPEN to CLOSE
const WINDOW_MS = 120_000;               // sliding window = 2 min

// ── State ──────────────────────────────────────────────────────────────────────

type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CBData {
    state: CBState;
    failureCount: number;
    successCount: number;
    lastFailureAt: number;
    openedAt: number;
}

// ── Redis Helpers ─────────────────────────────────────────────────────────────

function cbKey(routerId: string): string {
    return `router:circuit:${routerId}`;
}

async function getCBData(routerId: string): Promise<CBData> {
    const redis = getRedisConnection();
    const raw = await (redis as any).get(cbKey(routerId));
    if (!raw) {
        return { state: "CLOSED", failureCount: 0, successCount: 0, lastFailureAt: 0, openedAt: 0 };
    }
    try {
        return JSON.parse(raw) as CBData;
    } catch {
        return { state: "CLOSED", failureCount: 0, successCount: 0, lastFailureAt: 0, openedAt: 0 };
    }
}

async function setCBData(routerId: string, data: CBData): Promise<void> {
    const redis = getRedisConnection();
    // Expire after 24h to prevent stale entries
    await (redis as any).set(cbKey(routerId), JSON.stringify(data), "EX", 86400);
}

// ── Circuit Breaker ────────────────────────────────────────────────────────────

export interface RouterCircuitBreaker {
    routerId: string;
    /** Returns true if the request should be allowed through */
    canAttempt(): Promise<boolean>;
    /** Call on successful adapter operation */
    recordSuccess(): Promise<void>;
    /** Call on failed adapter operation */
    recordFailure(error?: string): Promise<void>;
    /** Get current state for monitoring */
    getState(): Promise<{ state: CBState; failureCount: number; openedAt?: number }>;
    /** Admin: manually reset the breaker */
    reset(): Promise<void>;
}

export function getCircuitBreaker(routerId: string): RouterCircuitBreaker {
    return {
        routerId,

        async canAttempt(): Promise<boolean> {
            const data = await getCBData(routerId);
            const now = Date.now();

            if (data.state === "CLOSED") return true;

            if (data.state === "OPEN") {
                if (now - data.openedAt >= RESET_TIMEOUT_MS) {
                    await setCBData(routerId, { ...data, state: "HALF_OPEN", successCount: 0 });
                    logger.info(`[CircuitBreaker] Router ${routerId}: OPEN → HALF_OPEN (trial attempt)`);
                    return true;
                }
                const remainMs = RESET_TIMEOUT_MS - (now - data.openedAt);
                logger.warn(`[CircuitBreaker] Router ${routerId}: circuit OPEN — blocked (${Math.round(remainMs / 1000)}s remaining)`);
                return false;
            }

            // HALF_OPEN: allow one attempt
            return true;
        },

        async recordSuccess(): Promise<void> {
            const data = await getCBData(routerId);
            if (data.state === "CLOSED") return;

            if (data.state === "HALF_OPEN") {
                const newSuccess = data.successCount + 1;
                if (newSuccess >= SUCCESS_THRESHOLD) {
                    await setCBData(routerId, { state: "CLOSED", failureCount: 0, successCount: 0, lastFailureAt: 0, openedAt: 0 });
                    logger.info(`[CircuitBreaker] Router ${routerId}: HALF_OPEN → CLOSED ✅`);
                } else {
                    await setCBData(routerId, { ...data, successCount: newSuccess });
                }
            }
        },

        async recordFailure(error?: string): Promise<void> {
            const data = await getCBData(routerId);
            const now = Date.now();

            if (data.state === "HALF_OPEN") {
                await setCBData(routerId, { ...data, state: "OPEN", openedAt: now, failureCount: data.failureCount + 1 });
                logger.warn(`[CircuitBreaker] Router ${routerId}: HALF_OPEN → OPEN (probe failed: ${error})`);
                return;
            }

            const withinWindow = (now - data.lastFailureAt) < WINDOW_MS;
            const newCount = withinWindow ? data.failureCount + 1 : 1;

            if (newCount >= FAILURE_THRESHOLD) {
                await setCBData(routerId, { state: "OPEN", failureCount: newCount, successCount: 0, lastFailureAt: now, openedAt: now });
                logger.error(`[CircuitBreaker] Router ${routerId}: CLOSED → OPEN 🚨 (${newCount} failures in window)`);
            } else {
                await setCBData(routerId, { ...data, state: "CLOSED", failureCount: newCount, lastFailureAt: now });
                logger.warn(`[CircuitBreaker] Router ${routerId}: failure ${newCount}/${FAILURE_THRESHOLD}`);
            }
        },

        async getState() {
            const data = await getCBData(routerId);
            return { state: data.state, failureCount: data.failureCount, openedAt: data.openedAt || undefined };
        },

        async reset() {
            await setCBData(routerId, { state: "CLOSED", failureCount: 0, successCount: 0, lastFailureAt: 0, openedAt: 0 });
            logger.info(`[CircuitBreaker] Router ${routerId}: manually reset to CLOSED`);
        },
    };
}
