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
        const { default: db } = await import('./src/lib/prisma');
        await db.$disconnect();
    } catch {
        // ignore — prisma may not have been initialised
    }
}
