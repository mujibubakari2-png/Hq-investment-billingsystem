/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/encryption', () => ({
  encryptPaymentChannelFields: jest.fn(() => ({})),
}));

describe('payment channel routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUT disables the old tenant gateway when provider changes', async () => {
    const route = require('@/app/api/payment-channels/[id]/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-1', userId: 'admin-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    const db = {
      paymentChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ch-1',
          tenantId: 'tenant-a',
          provider: 'PALMPESA',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'ch-1',
          tenantId: 'tenant-a',
          provider: 'ZENOPAY',
          name: 'ZenoPay',
          status: 'ACTIVE',
          config: null,
        }),
      },
      tenantPaymentGateway: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/payment-channels/ch-1', {
      method: 'PUT',
      body: JSON.stringify({ provider: 'ZENOPAY', name: 'ZenoPay', status: 'ACTIVE' }),
    });

    const res = await route.PUT(req, { params: Promise.resolve({ id: 'ch-1' }) });

    expect(res.status).toBe(200);
    expect(db.tenantPaymentGateway.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', provider: 'PALMPESA' },
      data: { enabled: false, status: 'INACTIVE' },
    });
    expect(db.tenantPaymentGateway.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_provider: { tenantId: 'tenant-a', provider: 'ZENOPAY' } },
    }));
  });
});
