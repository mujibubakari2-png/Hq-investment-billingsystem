/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * MEDIUM-O-003 FIX: Intercepts the global `console` object and redirects every
 * console.log/warn/error call to the structured pino logger, ensuring ALL
 * legacy route-handler console calls appear in BetterStack with:
 *   - ISO timestamp
 *   - Structured JSON format (searchable/filterable)
 *   - Correct log level
 *   - Environment and service metadata
 *
 * This file is loaded ONCE per process by Next.js before any routes run.
 * It does NOT affect the logger.ts itself (which calls the original console
 * methods — it captures them before the override is applied).
 *
 * Note: This only runs in the Node.js runtime (not Edge Runtime).
 * To enable: add `experimental: { instrumentationHook: true }` to next.config.js
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Lazy import — only runs in the Node.js runtime
        const { default: logger } = await import('@/lib/logger');

        // Save originals BEFORE overriding (logger.ts uses them internally)
        const _origLog   = console.log.bind(console);
        const _origWarn  = console.warn.bind(console);
        const _origError = console.error.bind(console);

        // Helper: stringify args the same way Node's console does
        function fmt(...args: unknown[]): string {
            return args.map(a =>
                typeof a === 'string' ? a :
                a instanceof Error   ? `${a.message}\n${a.stack ?? ''}` :
                JSON.stringify(a)
            ).join(' ');
        }

        console.log = (...args: unknown[]) => {
            logger.info(fmt(...args), { source: 'console.log' });
        };

        console.warn = (...args: unknown[]) => {
            logger.warn(fmt(...args), { source: 'console.warn' });
        };

        console.error = (...args: unknown[]) => {
            logger.error(fmt(...args), { source: 'console.error' });
        };

        // Keep debug pointing to the original console (non-critical noise)
        // console.debug is left as-is

        logger.info('[Instrumentation] console.* redirected to structured logger');
    }
}
