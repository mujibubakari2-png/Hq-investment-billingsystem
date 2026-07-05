/**
 * Jest Global Teardown
 *
 * Runs once after ALL test suites complete. Closes any open handles
 * (Redis connections, DB pools) so Jest exits cleanly without the
 * "Jest did not exit" warning.
 */

export default async function globalTeardown() {
    const shutdowns = [] as Array<Promise<unknown>>;

    try {
        const { closePrisma } = await import('./src/lib/prisma');
        shutdowns.push(closePrisma());
    } catch {
        // ignore — prisma may not have been initialised
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

    await Promise.allSettled(shutdowns);
}
