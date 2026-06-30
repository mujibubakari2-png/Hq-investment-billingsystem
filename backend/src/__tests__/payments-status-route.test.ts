/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockGetTenantClient = jest.fn();
const mockCheckStatus = jest.fn();
const mockCompleteTenantTransactionFromStatus = jest.fn();
const mockIsSupportedProvider = jest.fn();

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/payments/service', () => ({
  paymentService: {
    checkStatus: jest.fn((...args: any[]) => mockCheckStatus(...args)),
    completeTenantTransactionFromStatus: jest.fn((...args: any[]) => mockCompleteTenantTransactionFromStatus(...args)),
  },
}));

jest.mock('@/lib/payments/registry', () => ({
  isSupportedProvider: jest.fn((...args: any[]) => mockIsSupportedProvider(...args)),
}));

const route = require('@/app/api/payments/status/[reference]/route');

describe('public tenant payment status route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses stored providerRef and completes tenant transaction when provider polling returns COMPLETED', async () => {
    const expiresAt = new Date('2026-07-30T12:00:00Z');
    const globalDb = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tx-1',
          reference: 'HP-ABC123',
          status: 'PENDING',
          amount: 1000,
          planName: 'Daily Hotspot',
          method: 'PALMPESA',
          createdAt: new Date('2026-06-30T12:00:00Z'),
          tenantId: 'tenant-1',
          clientId: 'client-1',
          expiryDate: null,
          providerRef: 'PALM-ORDER-1',
          client: { id: 'client-1', username: 'alice' },
        }),
      },
    };

    mockGetTenantClient.mockReturnValue(globalDb);
    mockIsSupportedProvider.mockReturnValue(true);
    mockCheckStatus.mockResolvedValue({ status: 'COMPLETED', amount: 1000 });
    mockCompleteTenantTransactionFromStatus.mockResolvedValue({
      completed: true,
      status: 'COMPLETED',
      message: 'Payment processed successfully',
      expiresAt,
      username: 'alice',
    });

    const req = new NextRequest('http://localhost/api/payments/status/HP-ABC123?provider=PALMPESA');
    const res = await route.GET(req, { params: Promise.resolve({ reference: 'HP-ABC123' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCheckStatus).toHaveBeenCalledWith('PALMPESA', 'PALM-ORDER-1', 'tenant-1');
    expect(mockCompleteTenantTransactionFromStatus).toHaveBeenCalledWith('HP-ABC123', 'PALMPESA', 'PALM-ORDER-1', 1000);
    expect(body.status).toBe('COMPLETED');
    expect(body.username).toBe('alice');
    expect(body.expiresAt).toBe(expiresAt.toISOString());
    expect(body.autoConnect).toBe(true);
  });
});
