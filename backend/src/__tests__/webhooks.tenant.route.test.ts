/// <reference types="jest" />

const mockProcessWebhook = jest.fn(async () => ({ processed: true, message: 'Webhook processed' }));
const mockPaymentService = jest.fn().mockImplementation(() => ({
    processWebhook: mockProcessWebhook,
}));

jest.mock('@/lib/payments/service', () => ({
    __esModule: true,
    PaymentService: mockPaymentService,
}));

jest.mock('@/lib/rateLimiter', () => ({
    __esModule: true,
    checkRateLimit: jest.fn(async () => null),
}));

const { PaymentService } = require('@/lib/payments/service');
const route = require('@/app/api/webhooks/tenant/[tenantId]/[providerName]/route');

describe('Tenant webhook route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPaymentService.mockImplementation(() => ({
            processWebhook: mockProcessWebhook,
        }));
    });

    it('calls PaymentService.processWebhook and returns 200 when processed', async () => {
        const rawBody = JSON.stringify({ transactionRef: 'REF123', amount: 1000 });
        const req = {
            url: 'http://localhost/api/webhooks/tenant/t1/MOCK',
            headers: {
                forEach(callback: (value: string, key: string) => void) {
                    callback('application/json', 'content-type');
                    callback('test-header', 'x-custom');
                },
                get(name: string) {
                    return undefined;
                },
            },
            text: jest.fn(async () => rawBody),
        } as any;

        const params = Promise.resolve({ tenantId: 't1', providerName: 'MOCK' });

        const response = await route.POST(req, { params });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual({ message: 'Webhook processed' });
        expect(PaymentService).toHaveBeenCalledTimes(1);
        expect(mockProcessWebhook).toHaveBeenCalledWith('MOCK', expect.any(Object), rawBody, 't1');
    });

    it('returns 400 when processWebhook reports not processed', async () => {
        const mockProcess = jest.fn(async () => ({ processed: false, message: 'Invalid webhook' }));
        mockPaymentService.mockImplementation(() => ({ processWebhook: mockProcess }));

        const rawBody = JSON.stringify({ transactionRef: 'REF999', amount: 50 });
        const req = {
            url: 'http://localhost/api/webhooks/tenant/t2/MOCK',
            headers: {
                forEach(callback: (value: string, key: string) => void) {
                    callback('application/json', 'content-type');
                },
                get(name: string) {
                    return undefined;
                },
            },
            text: jest.fn(async () => rawBody),
        } as any;

        const params = Promise.resolve({ tenantId: 't2', providerName: 'MOCK' });

        const response = await route.POST(req, { params });

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json).toEqual({ error: 'Invalid webhook' });
        expect(mockProcess).toHaveBeenCalledWith('MOCK', expect.any(Object), rawBody, 't2');
    });

    it('handles invalid JSON body by sending empty object headers and still calling processWebhook', async () => {
        const rawBody = "{ invalid json }";
        const req = {
            url: 'http://localhost/api/webhooks/tenant/t3/MOCK',
            headers: {
                forEach(callback: (value: string, key: string) => void) {
                    callback('application/json', 'content-type');
                },
                get(name: string) {
                    return undefined;
                },
            },
            text: jest.fn(async () => rawBody),
        } as any;

        const params = Promise.resolve({ tenantId: 't3', providerName: 'MOCK' });

        const response = await route.POST(req, { params });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual({ message: 'Webhook processed' });
        expect(mockProcessWebhook).toHaveBeenCalledWith('MOCK', expect.any(Object), rawBody, 't3');
    });
});
