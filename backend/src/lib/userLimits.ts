import { getTenantClient } from "@/lib/tenantPrisma";

const DEFAULT_SUB_USER_LIMIT = 3;

function normalizePlanName(planName?: string | null): string {
    return (planName || "").trim().toLowerCase();
}

export function getSubUserLimitForPlan(planName?: string | null): number {
    const normalized = normalizePlanName(planName);

    if (normalized.includes("enterprise")) return 30;
    if (normalized.includes("business")) return 10;
    if (normalized.includes("starter")) return 3;

    return DEFAULT_SUB_USER_LIMIT;
}

export async function getTenantSubUserUsage(tenantId: string) {
    const db = getTenantClient(tenantId);
    const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
            id: true,
            plan: { select: { name: true } },
        },
    });

    if (!tenant) {
        throw new Error("Tenant not found");
    }

    const used = await db.user.count({
        where: {
            tenantId,
            role: { in: ["ADMIN", "AGENT", "VIEWER"] },
        },
    });

    const limit = getSubUserLimitForPlan(tenant.plan.name);
    return { used, limit, planName: tenant.plan.name };
}

export async function assertTenantCanAddSubUser(tenantId: string) {
    const usage = await getTenantSubUserUsage(tenantId);

    if (usage.used >= usage.limit) {
        throw new Error(
            `${usage.planName} allows ${usage.limit} sub user${usage.limit === 1 ? "" : "s"} under this tenant.`
        );
    }

    return usage;
}
