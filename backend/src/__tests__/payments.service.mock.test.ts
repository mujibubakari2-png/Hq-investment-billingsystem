/// <reference types="jest" />
/// <reference types="node" />

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(),
}));

jest.mock('@/lib/payments/registry', () => ({
    getPaymentProvider: jest.fn(),
    isSupportedProvider: jest.fn(() => true),
}));

jest.mock('@/lib/radius', () => ({
    syncRadiusUser: jest.fn(),
}));

jest.mock('@/lib/mikrotik', () => ({
    getMikroTikService: jest.fn(async () => ({
        activateService: jest.fn(async () => ({})),
    })),
}));

// `export {}` gives this file its own ES module scope, preventing
// "Cannot redeclare block-scoped variable" TS errors across test files.
export { };

const { getTenantClient } = require('@/lib/tenantPrisma');
const { getPaymentProvider } = require('@/lib/payments/registry');
const { syncRadiusUser } = require('@/lib/radius');
const { getMikroTikService } = require('@/lib/mikrotik');

const { paymentService } = require('@/lib/payments/service');

describe('PaymentService (mocked DB)', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('processes a successful webhook and marks transaction completed', async () => {
        const fakeTransaction = {
            id: 'tx1',
            reference: 'REF123',
            amount: 1000,
            status: 'PENDING',
            clientId: 'c1',
            client: { id: 'c1', username: 'user1', phone: '0710000000', fullName: 'User One', serviceType: 'HOTSPOT' },
            packageId: 'pkg1',
            tenantId: 't1',
        };

        const webhookLogCreate = jest.fn(async ({ data }: any) => ({ id: 'wl1', ...data }));
        const webhookLogUpdate = jest.fn(async () => ({}));

        const globalDb: any = {
            paymentChannel: { findFirst: jest.fn(async () => null) },
            webhookLog: { create: webhookLogCreate, update: webhookLogUpdate },
            transaction: {
                findFirst: jest.fn(async () => fakeTransaction),
                findUnique: jest.fn(async () => fakeTransaction),
                updateMany: jest.fn(async () => ({ count: 1 })),
                update: jest.fn(async () => ({})),
            },
            tenantInvoice: {
                findFirst: jest.fn(async () => null),
                update: jest.fn(async () => ({})),
            },
            tenantPayment: {
                findFirst: jest.fn(async () => null),
                update: jest.fn(async () => ({})),
            },
            invoice: {
                findFirst: jest.fn(async () => null),
                update: jest.fn(async () => ({})),
            },
            package: { findFirst: jest.fn(async () => ({ id: 'pkg1', duration: 1, durationUnit: 'DAYS', uploadSpeed: 1, downloadSpeed: 1, uploadUnit: 'Mbps', downloadUnit: 'Mbps', tenantId: 't1', routerId: undefined })) },
            subscription: {
                findFirst: jest.fn(async () => null),
                create: jest.fn(async () => ({ id: 'sub1', expiresAt: new Date() })),
                update: jest.fn(async () => ({})),
            },
            client: { update: jest.fn(async () => ({})) },
            routerLog: { create: jest.fn(async () => ({})) },
            $transaction: jest.fn(async (cb: any) => {
                return await cb(globalDb);
            }),
        };

        const tenantDb: any = {
            ...globalDb,
            webhookLog: { create: webhookLogCreate, update: webhookLogUpdate },
            $transaction: jest.fn(async (cb: any) => {
                return await cb(tenantDb);
            }),
        };

        (getTenantClient as jest.Mock).mockImplementation((tenantId: string | null) => {
            return tenantId === null ? globalDb : tenantDb;
        });

        const registry = require('@/lib/payments/registry');
        (registry.isSupportedProvider as jest.Mock).mockReturnValue(true);

        const providerMock = {
            verifyWebhook: jest.fn(async () => ({ verified: true })),
            parseWebhookPayload: jest.fn(() => ({ transactionRef: 'REF123', amount: 1000, resultCode: '0' })),
        } as any;
        (getPaymentProvider as jest.Mock).mockReturnValue(providerMock);

        const rawBody = JSON.stringify({ transactionRef: 'REF123', amount: 1000 });

        const result = await paymentService.processWebhook('MOCK', {}, rawBody, 't1');
        console.log('PROCESS RESULT:', result);
        expect(result.processed).toBe(true);
        expect(result.status).toBe('COMPLETED');
        expect(webhookLogCreate).toHaveBeenCalled();
        expect(webhookLogUpdate).toHaveBeenCalled();
    });

    it('continues to provider initiation when the transactions table is missing', async () => {
        const providerMock = {
            initiatePayment: jest.fn(async () => ({ success: true, message: 'OK', providerRef: 'ABC123' })),
        } as any;

        const registry = require('@/lib/payments/registry');
        (registry.isSupportedProvider as jest.Mock).mockReturnValue(true);
        (getPaymentProvider as jest.Mock).mockReturnValue(providerMock);
        (getTenantClient as jest.Mock).mockImplementation(() => ({
            paymentChannel: { findFirst: jest.fn(async () => null) },
            transaction: {
                findFirst: jest.fn(async () => {
                    const err: any = new Error('The table "public.transactions" does not exist');
                    err.code = 'P2021';
                    throw err;
                }),
            },
        }));

        const result = await paymentService.initiatePayment({
            tenantId: null,
            amount: 20000,
            phone: '0712345678',
            reference: 'TRACE-TEST',
            description: 'trace',
            callbackUrl: 'https://example.com/api/webhooks/palmpesa',
            providerName: 'PALMPESA',
            paymentContext: 'LICENSE',
        });

        expect(result.success).toBe(true);
        expect(providerMock.initiatePayment).toHaveBeenCalled();
    });

    it('falls back to transaction tenant when webhook tenantId is absent', async () => {
        const fakeTransaction = {
            id: 'tx2',
            reference: 'REF456',
            amount: 2000,
            status: 'PENDING',
            clientId: 'c2',
            client: { id: 'c2', username: 'user2', phone: '0720000000', fullName: 'User Two', serviceType: 'HOTSPOT' },
            packageId: 'pkg2',
            tenantId: 't2',
        };

        const globalWebhookLogCreate = jest.fn(async ({ data }: any) => ({ id: 'wl2', ...data }));
        const globalWebhookLogUpdate = jest.fn(async () => ({}));
        const tenantWebhookLogUpdate = jest.fn(async () => ({}));

        const globalDb: any = {
            paymentChannel: { findFirst: jest.fn(async () => null) },
            webhookLog: { create: globalWebhookLogCreate, update: globalWebhookLogUpdate },
            transaction: {
                findFirst: jest.fn(async () => fakeTransaction),
                findUnique: jest.fn(async () => fakeTransaction),
                updateMany: jest.fn(async () => ({ count: 1 })),
                update: jest.fn(async () => ({})),
            },
            tenantInvoice: {
                findFirst: jest.fn(async () => null),
                update: jest.fn(async () => ({})),
            },
            tenantPayment: {
                findFirst: jest.fn(async () => null),
                update: jest.fn(async () => ({})),
            },
            invoice: {
                findFirst: jest.fn(async () => null),
                update: jest.fn(async () => ({})),
            },
            package: { findFirst: jest.fn(async () => ({ id: 'pkg2', duration: 1, durationUnit: 'DAYS', uploadSpeed: 1, downloadSpeed: 1, uploadUnit: 'Mbps', downloadUnit: 'Mbps', tenantId: 't2', routerId: undefined })) },
            subscription: {
                findFirst: jest.fn(async () => null),
                create: jest.fn(async () => ({ id: 'sub2', expiresAt: new Date() })),
                update: jest.fn(async () => ({})),
            },
            client: { update: jest.fn(async () => ({})) },
            routerLog: { create: jest.fn(async () => ({})) },
            $transaction: jest.fn(async (cb: any) => {
                return await cb(globalDb);
            }),
        };

        const tenantDb: any = {
            ...globalDb,
            webhookLog: { create: globalWebhookLogCreate, update: globalWebhookLogUpdate },
            $transaction: jest.fn(async (cb: any) => {
                return await cb(tenantDb);
            }),
        };

        (getTenantClient as jest.Mock).mockImplementation((tenantId: string | null) => {
            return tenantId === null ? globalDb : tenantDb;
        });

        const registry = require('@/lib/payments/registry');
        (registry.isSupportedProvider as jest.Mock).mockReturnValue(true);

        const providerMock = {
            verifyWebhook: jest.fn(async () => ({ verified: true })),
            parseWebhookPayload: jest.fn(() => ({ transactionRef: 'REF456', amount: 2000, resultCode: '0' })),
        } as any;
        (getPaymentProvider as jest.Mock).mockReturnValue(providerMock);

        const rawBody = JSON.stringify({ transactionRef: 'REF456', amount: 2000 });

        const result = await paymentService.processWebhook('MOCK', {}, rawBody, null);
        console.log('RESULT2', result);
        expect(result.processed).toBe(true);
        expect(result.status).toBe('COMPLETED');
        expect(globalWebhookLogCreate).toHaveBeenCalled();
        expect(globalWebhookLogUpdate).toHaveBeenCalled();
    });
});
