/**
 * Provisioning Metrics Collector (Prometheus-compatible)
 *
 * ENTERPRISE-009: Observability for the provisioning and discovery pipelines.
 *
 * Exposes metrics via /api/metrics in Prometheus text format.
 * Key metrics:
 *
 *   router_provision_total{status, vendor}        — provisioning attempts
 *   router_provision_duration_ms{vendor}          — provisioning duration histogram
 *   router_provision_step_total{step, status}     — per-step outcomes
 *   router_discovery_total{status, vendor}        — discovery attempts
 *   router_circuit_breaker_state{router_id}       — circuit state (0=closed, 1=open, 2=half)
 *   router_drift_score{router_id}                 — config drift score (0-100)
 *   router_rate_limit_rejected_total{operation}   — rate limit rejections
 *   bullmq_queue_length{queue}                    — BullMQ queue depth
 *   bullmq_active_jobs{queue}                     — active jobs in flight
 *
 * Usage:
 *   GET /api/metrics → Prometheus text format (scrape by Prometheus/Grafana)
 */

import { getRedisConnection, getRouterQueue, getDiscoveryQueue } from "./queue";
import logger from "@/lib/logger";

// ── In-process counters (reset on restart — use Redis for persistence if needed) ──

interface Counter {
    [label: string]: number;
}

const counters: {
    provision_total: Counter;
    provision_duration_sum: Counter;
    provision_duration_count: Counter;
    discovery_total: Counter;
    rate_limit_rejected: Counter;
    step_total: Counter;
} = {
    provision_total: {},
    provision_duration_sum: {},
    provision_duration_count: {},
    discovery_total: {},
    rate_limit_rejected: {},
    step_total: {},
};

function incr(counter: Counter, label: string, value = 1): void {
    counter[label] = (counter[label] ?? 0) + value;
}

// ── Public metric recording functions ─────────────────────────────────────────

export function recordProvision(opts: {
    status: "completed" | "partial" | "failed";
    vendor: string;
    durationMs: number;
    stepCount: number;
    successCount: number;
    failureCount: number;
}): void {
    const label = `${opts.status}__${opts.vendor}`;
    incr(counters.provision_total, label);
    incr(counters.provision_duration_sum, opts.vendor, opts.durationMs);
    incr(counters.provision_duration_count, opts.vendor);
}

export function recordDiscovery(opts: { status: "success" | "failed"; vendor: string }): void {
    incr(counters.discovery_total, `${opts.status}__${opts.vendor}`);
}

export function recordRateLimitRejection(operation: string): void {
    incr(counters.rate_limit_rejected, operation);
}

export function recordStep(step: string, status: "success" | "failed" | "skipped"): void {
    incr(counters.step_total, `${step}__${status}`);
}

// ── Prometheus text format renderer ──────────────────────────────────────────

function counterLines(name: string, help: string, data: Counter): string {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
    for (const [label, value] of Object.entries(data)) {
        const parts = label.split("__");
        lines.push(`${name}{${parts.map((v, i) => `l${i}="${v}"`).join(",")}} ${value}`);
    }
    return lines.join("\n");
}

async function getQueueDepths(): Promise<Record<string, { waiting: number; active: number }>> {
    try {
        const ops = await getRouterQueue().getJobCounts("waiting", "active");
        const disc = await getDiscoveryQueue().getJobCounts("waiting", "active");
        return {
            "router-ops":       { waiting: ops.waiting ?? 0, active: ops.active ?? 0 },
            "router-discovery": { waiting: disc.waiting ?? 0, active: disc.active ?? 0 },
        };
    } catch {
        return {};
    }
}

async function getCircuitBreakerStates(): Promise<Array<{ routerId: string; state: number }>> {
    const redis = getRedisConnection();
    try {
        const keys: string[] = await (redis as any).keys("router:circuit:*");
        const results: Array<{ routerId: string; state: number }> = [];
        for (const key of keys.slice(0, 50)) { // cap at 50 to avoid huge payloads
            const raw = await (redis as any).get(key);
            if (!raw) continue;
            const data = JSON.parse(raw);
            const routerId = key.replace("router:circuit:", "");
            const stateNum = data.state === "CLOSED" ? 0 : data.state === "OPEN" ? 1 : 2;
            results.push({ routerId, state: stateNum });
        }
        return results;
    } catch {
        return [];
    }
}

async function getDriftScores(): Promise<Array<{ routerId: string; score: number }>> {
    const redis = getRedisConnection();
    try {
        const keys: string[] = await (redis as any).keys("router:config:drift:*");
        const results: Array<{ routerId: string; score: number }> = [];
        for (const key of keys.slice(0, 50)) {
            const raw = await (redis as any).get(key);
            if (!raw) continue;
            const report = JSON.parse(raw);
            const routerId = key.replace("router:config:drift:", "");
            results.push({ routerId, score: report.driftScore ?? 0 });
        }
        return results;
    } catch {
        return [];
    }
}

/**
 * Generate a full Prometheus text format metrics page.
 * Call this from GET /api/metrics.
 */
export async function generatePrometheusMetrics(): Promise<string> {
    const sections: string[] = [];

    // ── Provision counters
    sections.push(counterLines(
        "router_provision_total",
        "Total provisioning attempts by status and vendor",
        counters.provision_total
    ));

    // ── Provision duration
    sections.push([
        "# HELP router_provision_duration_ms_sum Total provisioning duration in milliseconds",
        "# TYPE router_provision_duration_ms_sum gauge",
        ...Object.entries(counters.provision_duration_sum).map(
            ([v, ms]) => `router_provision_duration_ms_sum{vendor="${v}"} ${ms}`
        ),
    ].join("\n"));
    sections.push([
        "# HELP router_provision_duration_ms_count Total provisioning calls counted",
        "# TYPE router_provision_duration_ms_count counter",
        ...Object.entries(counters.provision_duration_count).map(
            ([v, n]) => `router_provision_duration_ms_count{vendor="${v}"} ${n}`
        ),
    ].join("\n"));

    // ── Discovery
    sections.push(counterLines(
        "router_discovery_total",
        "Total discovery attempts by status and vendor",
        counters.discovery_total
    ));

    // ── Rate limit rejections
    sections.push(counterLines(
        "router_rate_limit_rejected_total",
        "Total rate-limited requests by operation",
        counters.rate_limit_rejected
    ));

    // ── Step outcomes
    sections.push(counterLines(
        "router_provision_step_total",
        "Provisioning step outcomes by step name and status",
        counters.step_total
    ));

    // ── Queue depths (async)
    const queues = await getQueueDepths();
    const queueLines = [
        "# HELP bullmq_queue_waiting_jobs Number of waiting jobs in each queue",
        "# TYPE bullmq_queue_waiting_jobs gauge",
        ...Object.entries(queues).map(([q, d]) => `bullmq_queue_waiting_jobs{queue="${q}"} ${d.waiting}`),
        "# HELP bullmq_queue_active_jobs Number of active jobs in each queue",
        "# TYPE bullmq_queue_active_jobs gauge",
        ...Object.entries(queues).map(([q, d]) => `bullmq_queue_active_jobs{queue="${q}"} ${d.active}`),
    ];
    sections.push(queueLines.join("\n"));

    // ── Circuit breaker states
    const cbStates = await getCircuitBreakerStates();
    if (cbStates.length > 0) {
        sections.push([
            "# HELP router_circuit_breaker_state Circuit breaker state per router (0=CLOSED,1=OPEN,2=HALF_OPEN)",
            "# TYPE router_circuit_breaker_state gauge",
            ...cbStates.map(({ routerId, state }) =>
                `router_circuit_breaker_state{router_id="${routerId}"} ${state}`
            ),
        ].join("\n"));
    }

    // ── Drift scores
    const driftScores = await getDriftScores();
    if (driftScores.length > 0) {
        sections.push([
            "# HELP router_config_drift_score Configuration drift score per router (0=clean,100=severe)",
            "# TYPE router_config_drift_score gauge",
            ...driftScores.map(({ routerId, score }) =>
                `router_config_drift_score{router_id="${routerId}"} ${score}`
            ),
        ].join("\n"));
    }

    return sections.join("\n\n") + "\n";
}
