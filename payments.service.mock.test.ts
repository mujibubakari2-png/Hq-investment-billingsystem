/// <reference types="jest" />

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(),
}));

jest.mock('@/lib/payments/registry', () => ({
    getPaymentProvider: jest.fn(),
    isSupportedProvider: jest.fn(() => true),
}));

const { getTenantClient } = require('@/lib/tenantPrisma');
const { getPaymentProvider } = require('@/lib/payments/registry');

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

        const fakeDb: any = {
            paymentChannel: { findFirst: jest.fn(async () => null) },
            webhookLog: { create: webhookLogCreate, update: webhookLogUpdate },
            transaction: {
                findFirst: jest.fn(async () => fakeTransaction),
                findUnique: jest.fn(async () => fakeTransaction),
                updateMany: jest.fn(async () => ({ count: 1 })),
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
                return await cb(fakeDb);
            }),
        };

        (getTenantClient as jest.Mock).mockImplementation(() => fakeDb);

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
});
