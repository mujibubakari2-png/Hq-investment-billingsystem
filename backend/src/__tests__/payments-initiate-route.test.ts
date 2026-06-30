/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetAssignTenantId = jest.fn();
const mockCanAccessTenant = jest.fn();
const mockGetTenantClient = jest.fn();
const mockInitiatePayment = jest.fn();
const mockIsSupportedProvider = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenant', () => ({
  getAssignTenantId: jest.fn((...args: any[]) => mockGetAssignTenantId(...args)),
  canAccessTenant: jest.fn((...args: any[]) => mockCanAccessTenant(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/payments/service', () => ({
  paymentService: {
    initiatePayment: jest.fn((...args: any[]) => mockInitiatePayment(...args)),
  },
}));

jest.mock('@/lib/payments/registry', () => ({
  isSupportedProvider: jest.fn((...args: any[]) => mockIsSupportedProvider(...args)),
  SUPPORTED_PROVIDERS: ['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'],
}));

jest.mock('@/lib/prisma', () => ({
  systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
}));

const route = require('@/app/api/payments/initiate/route');

describe('payments initiate route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-1' },
    });
    mockGetAssignTenantId.mockReturnValue('tenant-1');
    mockCanAccessTenant.mockReturnValue(true);
    mockIsSupportedProvider.mockReturnValue(true);
  });

  it('rejects tenant payment initiation without an existing pending transaction reference', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'PALMPESA',
        phone: '0712345678',
        amount: 1000,
        reference: 'HP-MISSING',
      }),
    });

    const res = await route.POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('Pending tenant transaction not found');
    expect(mockInitiatePayment).not.toHaveBeenCalled();
  });

  it('stores providerRef on the existing pending transaction after initiation', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tx-1', amount: 1000 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);
    mockInitiatePayment.mockResolvedValue({
      success: true,
      message: 'OK',
      reference: 'HP-EXISTS',
      providerRef: 'PALM-ORDER-1',
    });

    const req = new NextRequest('http://localhost/api/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'PALMPESA',
        phone: '0712345678',
        amount: 1000,
        reference: 'HP-EXISTS',
      }),
    });

    const res = await route.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockInitiatePayment).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      reference: 'HP-EXISTS',
      paymentContext: 'TENANT',
    }));
    expect(db.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { providerRef: 'PALM-ORDER-1', method: 'PALMPESA' },
    });
    expect(body.providerRef).toBe('PALM-ORDER-1');
  });
});
