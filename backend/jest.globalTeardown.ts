/**
 * Jest Global Teardown
 *
 * Runs once after ALL test suites complete. Closes any open handles
 * (Redis connections, DB pools) so Jest exits cleanly without the
 * "Jest did not exit" warning.
 *
 * IMPORTANT: Do NOT import prisma.ts unconditionally here — importing it
 * triggers createPrismaClient() which opens a NEW pg.Pool in the teardown
 * process context. That pool's idleTimeoutMillis keeps the event loop alive
 * and prevents Jest from exiting cleanly.
 *
 * Instead, only close resources that are already held in globalThis from
 * the actual test run.
 */

export default async function globalTeardown() {
    const shutdowns = [] as Array<Promise<unknown>>;

    // Close the Prisma pg.Pool only if one was actually created during tests.
    // Accessing globalThis.prismaPool directly avoids re-importing prisma.ts
    // (which would open a fresh pool in this teardown process).
    const globalAny = globalThis as any;
    if (globalAny.prismaPool) {
        const pool = globalAny.prismaPool;
        globalAny.prismaPool = undefined;
        shutdowns.push(
            pool.end().catch(() => {/* ignore — best-effort */})
        );
    }
    if (globalAny.prisma) {
        const client = globalAny.prisma;
        globalAny.prisma = undefined;
        shutdowns.push(
            client.$disconnect().catch(() => {/* ignore — best-effort */})
        );
    }

    try {
        const { closeCache } = await import('./src/lib/cache');
        shutdowns.push(closeCache());
    } catch {
        // ignore — cache may not have been initialised
    }

    try {
        const { closeMikroTikQueue } = await import('./src/lib/queue');
        shutdowns.push(closeMikroTikQueue());
    } catch {
        // ignore — queue may not have been initialised
    }

    try {
        const { closeRadiusQueue } = await import('./src/lib/radius-queue');
        shutdowns.push(closeRadiusQueue());
    } catch {
        // ignore — radius queue may not have been initialised
    }

    await Promise.allSettled(shutdowns);

    // Give the event loop a short chance to settle before Jest exits.
    await new Promise((resolve) => setTimeout(resolve, 100));
}
