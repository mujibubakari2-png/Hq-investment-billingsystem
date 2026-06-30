import { backfillRadiusAccountingTenants, getTenantRadiusNasIps } from '@/lib/radiusTenant';

describe('radius tenant mapping helpers', () => {
    it('collects NAS IPs from routers and RADIUS NAS clients for a tenant', async () => {
        const db: any = {
            router: {
                findMany: jest.fn().mockResolvedValue([
                    { host: '172.16.1.10', wgTunnelIp: '10.0.0.10' },
                ]),
            },
            radiusNas: {
                findMany: jest.fn().mockResolvedValue([
                    { nasName: '10.0.0.20', server: '172.16.1.20' },
                ]),
            },
        };

        await expect(getTenantRadiusNasIps(db, 'tenant-1')).resolves.toEqual([
            '172.16.1.10',
            '10.0.0.10',
            '10.0.0.20',
            '172.16.1.20',
        ]);
    });

    it('backfills radacct tenantId from router and RADIUS NAS mappings', async () => {
        const updateMany = jest.fn().mockResolvedValue({ count: 1 });
        const db: any = {
            router: {
                findMany: jest.fn().mockResolvedValue([
                    { host: '172.16.1.10', wgTunnelIp: '10.0.0.10', tenantId: 'tenant-1' },
                ]),
            },
            radiusNas: {
                findMany: jest.fn().mockResolvedValue([
                    { nasName: '10.0.0.20', server: null, tenantId: 'tenant-2' },
                ]),
            },
            radAcct: { updateMany },
        };

        await backfillRadiusAccountingTenants(db);

        expect(updateMany).toHaveBeenCalledWith({
            where: {
                tenantId: null,
                nasipaddress: { in: ['172.16.1.10', '10.0.0.10'] },
            },
            data: { tenantId: 'tenant-1' },
        });
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                tenantId: null,
                nasipaddress: { in: ['10.0.0.20'] },
            },
            data: { tenantId: 'tenant-2' },
        });
    });
});
