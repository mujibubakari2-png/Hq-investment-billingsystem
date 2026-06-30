type DbLike = {
    router: {
        findMany: (args: any) => Promise<Array<{ host?: string | null; wgTunnelIp?: string | null; tenantId?: string | null }>>;
    };
    radiusNas: {
        findMany: (args: any) => Promise<Array<{ nasName?: string | null; server?: string | null; tenantId?: string | null }>>;
    };
    radAcct: {
        updateMany: (args: any) => Promise<unknown>;
    };
};

function unique(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map(v => v?.trim()).filter(Boolean) as string[]));
}

export async function getTenantRadiusNasIps(db: DbLike, tenantId: string | null | undefined): Promise<string[]> {
    if (!tenantId) return [];

    const [routers, nasClients] = await Promise.all([
        db.router.findMany({
            where: { tenantId },
            select: { host: true, wgTunnelIp: true },
        }),
        db.radiusNas.findMany({
            where: { tenantId },
            select: { nasName: true, server: true },
        }),
    ]);

    return unique([
        ...routers.flatMap(router => [router.host, router.wgTunnelIp]),
        ...nasClients.flatMap(nas => [nas.nasName, nas.server]),
    ]);
}

export async function backfillRadiusAccountingTenants(db: DbLike) {
    const [routers, nasClients] = await Promise.all([
        db.router.findMany({
            where: { tenantId: { not: null } },
            select: { host: true, wgTunnelIp: true, tenantId: true },
        }),
        db.radiusNas.findMany({
            where: { tenantId: { not: null } },
            select: { nasName: true, server: true, tenantId: true },
        }),
    ]);

    const byTenant = new Map<string, string[]>();
    for (const router of routers) {
        if (!router.tenantId) continue;
        byTenant.set(
            router.tenantId,
            unique([...(byTenant.get(router.tenantId) ?? []), router.host, router.wgTunnelIp])
        );
    }
    for (const nas of nasClients) {
        if (!nas.tenantId) continue;
        byTenant.set(
            nas.tenantId,
            unique([...(byTenant.get(nas.tenantId) ?? []), nas.nasName, nas.server])
        );
    }

    for (const [tenantId, ips] of byTenant) {
        if (ips.length === 0) continue;
        await db.radAcct.updateMany({
            where: {
                tenantId: null,
                nasipaddress: { in: ips },
            },
            data: { tenantId },
        });
    }
}
