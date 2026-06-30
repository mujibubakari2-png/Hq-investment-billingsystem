/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();

jest.mock('@/lib/rbac', () => ({
    requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

const route = require('@/app/api/payment-channels/test-api/route');

describe('Payment channel test API route', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        mockRequirePermission.mockReturnValue({ error: null, user: { id: 'user-1' } });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('normalizes official provider test URLs without adding undocumented fallbacks', () => {
        expect(route.normalizeUrl('https://example.com/', '/api/order-status')).toBe(
            'https://example.com/api/order-status'
        );
    });

    it('returns success when the provider endpoint responds with HTTP 200', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            status: 200,
            text: async () => JSON.stringify({ message: 'OK' }),
        });

        const req = new NextRequest('http://localhost/api/payment-channels/test-api', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'ZENOPAY',
                apiKey: 'test-key',
                apiUrl: 'https://zenoapi.com/api',
            }),
        });

        const res = await route.POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.provider).toBe('ZENOPAY');
        expect(json.testedUrl).toBe('https://zenoapi.com/api/order-status?order_id=test-ping');
    });

    it('returns success when the provider endpoint responds with HTTP 404 and 404 is considered reachable', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            status: 404,
            text: async () => JSON.stringify({ error: 'Not found' }),
        });

        const req = new NextRequest('http://localhost/api/payment-channels/test-api', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'HARAKAPAY',
                apiKey: 'test-key',
            apiUrl: 'https://harakapay.net',
            }),
        });

        const res = await route.POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(false);
        expect(json.statusCode).toBe(404);
        expect(json.message).toContain('responded with HTTP 404');
    });
});
