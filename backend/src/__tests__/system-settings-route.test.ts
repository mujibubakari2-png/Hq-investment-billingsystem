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

describe('system settings route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects legacy paymentGateways writes because channels are managed by PaymentChannel', async () => {
    const route = require('@/app/api/system-settings/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-1', userId: 'admin-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    const db = {
      systemSetting: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/system-settings', {
      method: 'PUT',
      body: JSON.stringify({ paymentGateways: '[]' }),
    });

    const res = await route.PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Payment Channels/i);
    expect(db.systemSetting.create).not.toHaveBeenCalled();
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });
});
