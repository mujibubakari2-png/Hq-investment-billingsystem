/**
 * Jest Global Teardown
 *
 * Runs once after ALL test suites complete. Closes any open handles
 * (Redis connections, DB pools) so Jest exits cleanly without the
 * "Jest did not exit" warning.
 */

export default async function globalTeardown() {
    // Close Redis connection from cache.ts singleton
    try {
        const { closeCache } = await import('./src/lib/cache');
        await closeCache();
    } catch {
        // ignore — cache may not have been initialised
    }

    // Close the Prisma database connection pool
    try {
        const { closePrisma } = await import('./src/lib/prisma');
        await closePrisma();
    } catch {
        // ignore — prisma may not have been initialised
    }

    // Close BullMQ queue if a route test initialised it
    try {
        const { closeMikroTikQueue } = await import('./src/lib/queue');
        await closeMikroTikQueue();
    } catch {
        // ignore — queue may not have been initialised
    }
}
