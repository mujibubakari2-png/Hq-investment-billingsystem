/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequireRole = jest.fn();
const mockGetTenantClient = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requireRole: jest.fn((...args: any[]) => mockRequireRole(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/tenant', () => ({
  isPlatformSuperAdmin: jest.fn(() => true),
}));

const route = require('@/app/api/admin/saas-invoices/route');

describe('admin saas invoices route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });
  });

  it('does not confirm an already paid invoice again', async () => {
    const db = {
      tenantInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: 'PAID',
          tenantId: 'tenant-1',
          amount: 10000,
          tenant: { licenseExpiresAt: new Date('2026-07-30T00:00:00Z') },
        }),
      },
      $transaction: jest.fn(),
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/admin/saas-invoices', {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm_payment', invoiceId: 'inv-1' }),
    });
    const res = await route.POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already paid');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
