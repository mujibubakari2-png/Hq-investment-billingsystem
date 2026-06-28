/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockGetTenantClient = jest.fn();
const mockCheckStatus = jest.fn();
const mockIsSupportedProvider = jest.fn();

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

const route = require('@/app/api/payments/status/[reference]/route');

describe('payment status route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pending status for license renewal payments from tenantPayment records', async () => {
    const globalDb = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenantPayment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-1',
          status: 'PENDING',
          amount: 20000,
          tenantId: 'tenant-1',
          paymentMethod: 'PALMPESA',
          transactionId: 'checkout-123',
          createdAt: new Date(),
          invoice: { invoiceNumber: 'INV-1001' },
        }),
      },
    };

    mockGetTenantClient.mockReturnValue(globalDb);
    mockIsSupportedProvider.mockReturnValue(true);
    mockCheckStatus.mockResolvedValue({ status: 'PENDING' });

    const req = new NextRequest('http://localhost/api/payments/status/checkout-123?provider=PALMPESA&providerRef=checkout-123');
    const res = await route.GET(req, { params: Promise.resolve({ reference: 'checkout-123' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('PENDING');
    expect(body.method).toBe('PALMPESA');
    expect(body.amount).toBe(20000);
  });
});
