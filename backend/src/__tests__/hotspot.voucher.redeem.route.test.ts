/// <reference types="jest" />

import { NextRequest } from "next/server";

const mockGetTenantClient = jest.fn();
const mockSyncRadiusUser = jest.fn(async () => ({}));
const mockGetMikroTikService = jest.fn();

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn((tenantId: string | null) => mockGetTenantClient(tenantId)),
}));

jest.mock('@/lib/radius', () => ({
    syncRadiusUser: jest.fn((...args: any[]) => mockSyncRadiusUser.apply(null, args)),
}));

jest.mock('@/lib/mikrotik', () => ({
    getMikroTikService: jest.fn((...args: any[]) => mockGetMikroTikService(...args)),
    sanitizeMikroTikName: jest.requireActual('@/lib/mikrotik').sanitizeMikroTikName,
}));

const route = require('@/app/api/hotspot/voucher/redeem/route');

function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/hotspot/voucher/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function makeRouter(id: string, tenantId: string) {
    return { id, tenantId };
}

function makeVoucher(overrides: Record<string, any> = {}) {
    return {
        id: 'voucher-1234',
        code: 'SECRET-CODE-123',
        status: 'UNUSED',
        routerId: null,
        package: {
            id: 'pkg-abc',
            name: '10 Mbps',
            duration: 1,
            durationUnit: 'DAYS',
            uploadSpeed: 10,
            downloadSpeed: 10,
            uploadUnit: 'Mbps',
            downloadUnit: 'Mbps',
            tenantId: 'tenant-1',
            routerId: null,
            type: 'HOTSPOT',
        },
        ...overrides,
    };
}

function makeTenantDb(voucher: any) {
    return {
        router: {
            findUnique: jest.fn(async () => ({ id: 'router-1', tenantId: 'tenant-1' })),
        },
        voucher: {
            findFirst: jest.fn(async () => voucher),
            update: jest.fn(async ({ data }) => ({ ...voucher, ...data })),
        },
        client: {
            findFirst: jest.fn(async () => null),
            create: jest.fn(async (args: any) => ({ id: 'client-1', ...args.data })),
            update: jest.fn(async (args: any) => ({ id: 'client-1', ...args.data })),
        },
        subscription: {
            create: jest.fn(async (args: any) => ({ id: 'sub-1', ...args.data })),
        },
        routerLog: {
            create: jest.fn(async () => ({})),
        },
        $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
    };
}

function makeLookupDb(router: any) {
    return {
        router: {
            findUnique: jest.fn(async () => router),
        },
    };
}

function makeMikroTikService() {
    return {
        activateService: jest.fn(async () => ({})),
    };
}

describe('Hotspot voucher redeem route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetTenantClient.mockReset();
        mockSyncRadiusUser.mockReset();
        mockGetMikroTikService.mockReset();
    });

    it('creates a non-revealing HS- username for hotspot vouchers', async () => {
        const voucher = makeVoucher();
        const tenantDb = makeTenantDb(voucher);
        const lookupDb = makeLookupDb(makeRouter('router-1', 'tenant-1'));

        mockGetTenantClient.mockImplementation((tenantId: string | null) =>
            tenantId === null ? lookupDb : tenantDb
        );
        mockGetMikroTikService.mockResolvedValue(makeMikroTikService());

        const req = makeRequest({ code: voucher.code, routerId: 'router-1' });
        const res = await route.POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.username).toBe('HS-voucher-1234');
        expect(json.password).toBe(voucher.code);
        expect(json.username).not.toContain(voucher.code);

        expect(tenantDb.client.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    username: 'HS-voucher-1234',
                    serviceType: 'HOTSPOT',
                }),
            }),
        );
        expect(mockSyncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({
                username: 'HS-voucher-1234',
                password: voucher.code,
            }),
        );
    });

    it('creates a PE- username for PPPoE vouchers', async () => {
        const voucher = makeVoucher({
            id: 'pppoe-voucher-7',
            package: { ...makeVoucher().package, type: 'PPPOE' },
        });
        const tenantDb = makeTenantDb(voucher);
        const lookupDb = makeLookupDb(makeRouter('router-1', 'tenant-1'));

        mockGetTenantClient.mockImplementation((tenantId: string | null) =>
            tenantId === null ? lookupDb : tenantDb
        );
        mockGetMikroTikService.mockResolvedValue(makeMikroTikService());

        const req = makeRequest({ code: voucher.code, routerId: 'router-1' });
        const res = await route.POST(req);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.username).toBe('PE-pppoe-voucher-7');
        expect(json.password).toBe(voucher.code);

        expect(tenantDb.client.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    username: 'PE-pppoe-voucher-7',
                    serviceType: 'PPPOE',
                }),
            }),
        );
    });
});
