/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockRequireRole = jest.fn();
const mockGetTenantClient = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
  requireRole: jest.fn((...args: any[]) => mockRequireRole(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/cache', () => ({
  invalidateNamespace: jest.fn().mockResolvedValue(undefined),
}));

describe('finance records routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transactions GET supports limit=All and keeps platform admin unscoped', async () => {
    const route = require('@/app/api/transactions/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/transactions?limit=All&type=MOBILE');
    const res = await route.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limit).toBe(999999);
    expect(db.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 999999,
      where: expect.not.objectContaining({ tenantId: expect.anything() }),
    }));
  });

  it('transactions POST assigns platform-admin-created records to the client tenant', async () => {
    const route = require('@/app/api/transactions/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      client: {
        findUnique: jest.fn().mockResolvedValue({ id: 'client-1', tenantId: 'tenant-a' }),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({ id: 'txn-1', tenantId: 'tenant-a' }),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'client-1', amount: 1000, method: 'Cash' }),
    });
    const res = await route.POST(req);

    expect(res.status).toBe(201);
    expect(db.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-a', clientId: 'client-1' }),
    }));
  });

  it('transactions POST rejects tenant/client mismatch for platform admins', async () => {
    const route = require('@/app/api/transactions/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      client: {
        findUnique: jest.fn().mockResolvedValue({ id: 'client-1', tenantId: 'tenant-a' }),
      },
      transaction: {
        create: jest.fn(),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'client-1', tenantId: 'tenant-b', amount: 1000 }),
    });
    const res = await route.POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/tenantId does not match/i);
    expect(db.transaction.create).not.toHaveBeenCalled();
  });

  it('expenses GET uses tenant filter helper and returns tenantName for reporting', async () => {
    const route = require('@/app/api/expenses/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      expense: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'exp-1',
          category: 'Infrastructure',
          description: 'Fiber repair',
          amount: 5000,
          date: new Date('2026-06-30T10:00:00Z'),
          reference: 'RCPT-1',
          createdBy: { username: 'admin' },
          tenant: { name: 'Tenant A' },
        }]),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/expenses');
    const res = await route.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
    }));
    expect(body[0].tenantName).toBe('Tenant A');
  });

  it('invoices POST assigns super-admin-created client invoices to the client tenant', async () => {
    const route = require('@/app/api/invoices/route');
    mockRequireRole.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      client: {
        findUnique: jest.fn().mockResolvedValue({ id: 'client-1', tenantId: 'tenant-a' }),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: 'inv-1', tenantId: 'tenant-a', items: [] }),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        amount: 12000,
        items: [{ description: 'Monthly plan', quantity: 1, unitPrice: 12000, total: 12000 }],
      }),
    });
    const res = await route.POST(req);

    expect(res.status).toBe(201);
    expect(db.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        items: expect.objectContaining({
          create: [expect.objectContaining({ tenantId: 'tenant-a' })],
        }),
      }),
    }));
  });

  it('invoices POST rejects tenant/client mismatch for platform admins', async () => {
    const route = require('@/app/api/invoices/route');
    mockRequireRole.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      client: {
        findUnique: jest.fn().mockResolvedValue({ id: 'client-1', tenantId: 'tenant-a' }),
      },
      invoice: {
        create: jest.fn(),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        tenantId: 'tenant-b',
        amount: 12000,
      }),
    });
    const res = await route.POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/tenantId does not match/i);
    expect(db.invoice.create).not.toHaveBeenCalled();
  });
});
