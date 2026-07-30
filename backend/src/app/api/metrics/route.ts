import { NextRequest } from "next/server";
import { generatePrometheusMetrics } from "@/lib/metricsCollector";
import { requirePermission } from "@/lib/rbac";

/**
 * GET /api/metrics
 *
 * Prometheus-compatible metrics endpoint.
 * Scrape with:  prometheus.yml → targets: ['your-api:3001']
 *
 * Protected: SUPER_ADMIN or PLATFORM_SUPER_ADMIN only.
 * In production, add IP allowlist or mTLS for Prometheus scraper.
 */
export async function GET(req: NextRequest) {
    // Allow Prometheus scraper via bearer token or admin session
    const authHeader = req.headers.get("authorization") ?? "";
    const scrapeToken = process.env.METRICS_SCRAPE_TOKEN;

    const isScraper = scrapeToken && authHeader === `Bearer ${scrapeToken}`;

    if (!isScraper) {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const role = guard.user.role;
        if (role !== "SUPER_ADMIN" && !guard.user.tenantId === null) {
            return new Response("Forbidden", { status: 403 });
        }
    }

    try {
        const metrics = await generatePrometheusMetrics();
        return new Response(metrics, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
                "Cache-Control": "no-cache, no-store",
            },
        });
    } catch (err: any) {
        return new Response(`# ERROR: ${err.message}\n`, {
            status: 500,
            headers: { "Content-Type": "text/plain" },
        });
    }
}
