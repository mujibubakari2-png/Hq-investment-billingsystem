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

    it('normalizes URLs and includes /api fallback for non-API base URLs', () => {
        expect(route.normalizeUrl('https://example.com/', '/payments/status/test-ping')).toBe(
            'https://example.com/payments/status/test-ping'
        );
        expect(route.getTestUrls('https://example.com/', '/payments/status/test-ping')).toEqual([
            'https://example.com/payments/status/test-ping',
            'https://example.com/api/payments/status/test-ping',
        ]);
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
        expect(json.testedUrl).toBe('https://zenoapi.com/api/payments/status/test-ping');
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
                apiUrl: 'https://harakapay.net/api',
            }),
        });

        const res = await route.POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.statusCode).toBe(404);
        expect(json.message).toContain('API is reachable');
    });
});
