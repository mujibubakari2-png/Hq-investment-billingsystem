/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();

jest.mock('@/lib/rbac', () => ({
    requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

const route = require('@/app/api/mobile-transactions/route');

describe('mobile transactions route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRequirePermission.mockReturnValue({
            error: null,
            user: {
                userId: 'user-1',
                id: 'user-1',
                role: 'ADMIN',
                tenantId: 'tenant-1',
            },
        });
    });

    it('returns tenant mobile payment statuses and provider references without old gateway settings', async () => {
        const db = {
            paymentChannel: {
                findMany: jest.fn().mockResolvedValue([
                    { provider: 'PALMPESA', name: 'PalmPesa' },
                ]),
            },
            systemSetting: {
                findFirst: jest.fn(),
            },
            transaction: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'tx-pending',
                        client: { username: 'alice', fullName: 'Alice' },
                        planName: 'Daily Hotspot',
                        amount: 1000,
                        type: 'MOBILE',
                        method: 'PALMPESA',
                        status: 'PENDING',
                        createdAt: new Date('2026-06-30T08:00:00Z'),
                        expiryDate: null,
                        reference: 'INT-001',
                        providerRef: 'PALM-ORDER-001',
                    },
                    {
                        id: 'tx-completed',
                        client: { username: 'bob', fullName: 'Bob' },
                        planName: 'PPPoE Monthly',
                        amount: 30000,
                        type: 'MOBILE',
                        method: 'PALMPESA',
                        status: 'COMPLETED',
                        createdAt: new Date('2026-06-30T09:00:00Z'),
                        expiryDate: null,
                        reference: 'INT-002',
                        providerRef: 'PALM-ORDER-002',
                    },
                ]),
            },
        };
        mockGetTenantClient.mockReturnValue(db);

        const req = new NextRequest('http://localhost/api/mobile-transactions?limit=All');
        const res = await route.GET(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(db.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ tenantId: 'tenant-1', type: 'MOBILE' }),
        }));
        expect(db.systemSetting.findFirst).not.toHaveBeenCalled();
        expect(json.total).toBe(2);
        expect(json.data.map((tx: any) => tx.status)).toEqual(['Pending', 'Completed']);
        expect(json.data.map((tx: any) => tx.method)).toEqual(['PALMPESA', 'PALMPESA']);
        expect(json.data[0].providerRef).toBe('PALM-ORDER-001');
        expect(json.data[0].reference).toBe('PALM-ORDER-001');
        expect(json.summaries.month.pending).toBe(1);
        expect(json.summaries.month.paid).toBe(1);

        const filteredReq = new NextRequest('http://localhost/api/mobile-transactions?limit=All&method=PALMPESA&status=Completed');
        const filteredRes = await route.GET(filteredReq);
        const filteredJson = await filteredRes.json();

        expect(filteredRes.status).toBe(200);
        expect(filteredJson.total).toBe(1);
        expect(filteredJson.data[0].status).toBe('Completed');
        expect(filteredJson.data[0].method).toBe('PALMPESA');
    });
});
