/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();
const mockGetJwtTenantId = jest.fn();
const mockIsPlatformSuperAdmin = jest.fn();
const mockInitiatePayment = jest.fn();

jest.mock('@/lib/rbac', () => ({
    requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenant', () => ({
    getJwtTenantId: jest.fn((...args: any[]) => mockGetJwtTenantId(...args)),
    isPlatformSuperAdmin: jest.fn((...args: any[]) => mockIsPlatformSuperAdmin(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/payments/service', () => ({
    __esModule: true,
    paymentService: {
        initiatePayment: jest.fn((...args: any[]) => mockInitiatePayment(...args)),
    },
}));

const route = require('@/app/api/license/renew/route');

describe('License renewal payment route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.APP_URL = 'https://app.example.com';
        mockRequirePermission.mockReturnValue({ error: null, user: { id: 'user-1' } });
        mockGetJwtTenantId.mockReturnValue('tenant-1');
        mockIsPlatformSuperAdmin.mockReturnValue(false);
        mockInitiatePayment.mockResolvedValue({ success: true, message: 'OK' });
    });

    it('routes license renewals through the platform payment context', async () => {
        const tenantDb = {
            tenant: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'tenant-1',
                    name: 'Acme ISP',
                    email: 'ops@example.com',
                    planId: 'plan-1',
                    plan: { price: 20000 },
                }),
            },
            tenantInvoice: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'inv-1',
                    tenantId: 'tenant-1',
                    amount: 20000,
                    planId: 'plan-1',
                    packageMonths: 1,
                }),
            },
        };

        const globalDb = {
            paymentChannel: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
            tenantPayment: {
                create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
                update: jest.fn().mockResolvedValue({}),
            },
        };

        mockGetTenantClient.mockImplementation((tenantId: string | null) =>
            tenantId === null ? globalDb : tenantDb
        );
        mockInitiatePayment.mockResolvedValue({
            success: true,
            message: 'Payment initiated',
            providerRef: 'checkout-abc-123',
        });

        const req = new NextRequest('http://localhost/api/license/renew', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ packageMonths: 1, phoneNumber: '0712345678', invoiceId: 'inv-1' }),
        });

        const res = await route.POST(req);

        expect(res.status).toBe(200);
        expect(mockInitiatePayment).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: null,
                providerName: 'PALMPESA',
                paymentContext: 'LICENSE',
                amount: 20000,
                phone: expect.any(String),
            })
        );
    });

    it('returns an error when the license payment initiation fails', async () => {
        const tenantDb = {
            tenant: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'tenant-1',
                    name: 'Acme ISP',
                    email: 'ops@example.com',
                    planId: 'plan-1',
                    plan: { price: 20000 },
                }),
            },
            tenantInvoice: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'inv-1',
                    tenantId: 'tenant-1',
                    amount: 20000,
                    planId: 'plan-1',
                    packageMonths: 1,
                }),
            },
        };

        const globalDb = {
            paymentChannel: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
            tenantPayment: {
                create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
                update: jest.fn().mockResolvedValue({}),
            },
        };

        mockGetTenantClient.mockImplementation((tenantId: string | null) =>
            tenantId === null ? globalDb : tenantDb
        );
        mockInitiatePayment.mockResolvedValue({ success: false, message: 'STK push failed' });

        const req = new NextRequest('http://localhost/api/license/renew', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ packageMonths: 1, phoneNumber: '0712345678', invoiceId: 'inv-1' }),
        });

        const res = await route.POST(req);

        expect(res.status).toBe(500);
    });

    it('returns a gateway error for PalmPesa responses that were HTTP 200 but unusable', async () => {
        const tenantDb = {
            tenant: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'tenant-1',
                    name: 'Acme ISP',
                    email: 'ops@example.com',
                    planId: 'plan-1',
                    plan: { price: 20000 },
                }),
            },
            tenantInvoice: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'inv-1',
                    tenantId: 'tenant-1',
                    amount: 20000,
                    planId: 'plan-1',
                    packageMonths: 1,
                }),
            },
        };

        const globalDb = {
            paymentChannel: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
            tenantPayment: {
                create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
                update: jest.fn().mockResolvedValue({}),
            },
        };

        mockGetTenantClient.mockImplementation((tenantId: string | null) =>
            tenantId === null ? globalDb : tenantDb
        );
        mockInitiatePayment.mockResolvedValue({
            success: false,
            message: 'PalmPesa returned HTTP 200 but response body was empty.',
            status: 'EMPTY',
            code: 'EMPTY',
        });

        const req = new NextRequest('http://localhost/api/license/renew', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ packageMonths: 1, phoneNumber: '0712345678', invoiceId: 'inv-1' }),
        });

        const res = await route.POST(req);

        expect(res.status).toBe(502);
    });
});
