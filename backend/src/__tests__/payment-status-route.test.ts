/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockGetTenantClient = jest.fn();
const mockCheckStatus = jest.fn();
const mockIsSupportedProvider = jest.fn();
const mockRequirePermission = jest.fn();
const mockGetJwtTenantId = jest.fn();
const mockIsPlatformSuperAdmin = jest.fn();

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/payments/service', () => ({
  paymentService: {
    checkStatus: jest.fn((...args: any[]) => mockCheckStatus(...args)),
  },
}));

jest.mock('@/lib/payments/registry', () => ({
  isSupportedProvider: jest.fn((...args: any[]) => mockIsSupportedProvider(...args)),
}));

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenant', () => ({
  getJwtTenantId: jest.fn((...args: any[]) => mockGetJwtTenantId(...args)),
  isPlatformSuperAdmin: jest.fn((...args: any[]) => mockIsPlatformSuperAdmin(...args)),
}));

const route = require('@/app/api/license/payment-status/[reference]/route');

describe('payment status route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermission.mockReturnValue({ error: null, user: { id: 'user-1', tenantId: 'tenant-1' } });
    mockGetJwtTenantId.mockReturnValue('tenant-1');
    mockIsPlatformSuperAdmin.mockReturnValue(false);
  });

  it('returns pending status for license renewal payments from tenantPayment records', async () => {
    const globalDb = {
      tenantInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1',
          invoiceNumber: 'INV-1001',
          amount: 20000,
          tenantId: 'tenant-1',
          payments: [{
            id: 'pay-1',
            status: 'PENDING',
            amount: 20000,
            tenantId: 'tenant-1',
            paymentMethod: 'PALMPESA',
            transactionId: 'checkout-123',
            createdAt: new Date(),
          }],
        }),
      },
    };

    mockGetTenantClient.mockReturnValue(globalDb);
    mockIsSupportedProvider.mockReturnValue(true);
    mockCheckStatus.mockResolvedValue({ status: 'PENDING' });

    const req = new NextRequest('http://localhost/api/license/payment-status/INV-1001?provider=PALMPESA&providerRef=checkout-123');
    const res = await route.GET(req, { params: Promise.resolve({ reference: 'INV-1001' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('PENDING');
    expect(body.amount).toBe(20000);
    expect(body.providerRef).toBe('checkout-123');
  });
});
