/**
 * Multi-Tenant Isolation Tests
 *
 * Verifies that:
 * - getTenantClient() proxy forces WHERE tenantId into all queries
 * - A tenant cannot read another tenant's data
 * - Platform admin (tenantId=null) can read all tenants
 * - getChannel() never returns cross-tenant channels
 */

import { getTenantClient } from '@/lib/tenantPrisma';
import { isPlatformSuperAdmin, isTenantSuperAdmin, canAccessTenant } from '@/lib/tenant';
import { PaymentService } from '@/lib/payments/service';

// ── The mock factory is hoisted by Jest, so all variable references must live
// inside the factory function itself — const/let in module scope are in TDZ
// when the hoisted factory runs. We expose mocks via require() in each test.
jest.mock('@/lib/prisma', () => {
  function mkModel(overrides: Record<string, jest.Mock> = {}) {
    return {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirstOrThrow: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      ...overrides,
    };
  }
  return {
    __esModule: true,
    default: {
      paymentChannel: mkModel(),
      transaction: mkModel(),
      tenantInvoice: mkModel(),
      tenantPayment: mkModel(),
      invoice: mkModel(),
      webhookLog: mkModel({ create: jest.fn().mockResolvedValue({ id: 'wl-001' }) }),
      tenant: mkModel(),
      subscription: mkModel(),
      client: mkModel(),
      package: mkModel(),
      routerLog: mkModel(),
      $transaction: jest.fn(async (fn: any) =>
        fn({
          transaction: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          tenantInvoice: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
          tenantPayment: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
          subscription: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'sub-001' }), update: jest.fn().mockResolvedValue({}) },
          client: { update: jest.fn().mockResolvedValue({}) },
          invoice: { update: jest.fn().mockResolvedValue({}) },
          tenant: { update: jest.fn().mockResolvedValue({}) },
        })
      ),
    },
  };
});

jest.mock('@/lib/payments/registry', () => ({
  isSupportedProvider: jest.fn(() => true),
  getPaymentProvider: jest.fn(),
}));

// ─── Helper: build a fake JwtPayload ───────────────────────────────────────
function makeUser(role: string, tenantId: string | null | undefined) {
  return { sub: 'u-1', role, tenantId } as any;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Multi-Tenant Isolation — tenant.ts helpers', () => {
  it('isPlatformSuperAdmin: true for SUPER_ADMIN with no tenantId', () => {
    expect(isPlatformSuperAdmin(makeUser('SUPER_ADMIN', null))).toBe(true);
    expect(isPlatformSuperAdmin(makeUser('SUPER_ADMIN', undefined))).toBe(true);
  });

  it('isPlatformSuperAdmin: false for SUPER_ADMIN with a tenantId', () => {
    expect(isPlatformSuperAdmin(makeUser('SUPER_ADMIN', 'tenant-abc'))).toBe(false);
  });

  it('isTenantSuperAdmin: true for SUPER_ADMIN with a tenantId', () => {
    expect(isTenantSuperAdmin(makeUser('SUPER_ADMIN', 'tenant-abc'))).toBe(true);
  });

  it('isTenantSuperAdmin: false for SUPER_ADMIN with no tenantId', () => {
    expect(isTenantSuperAdmin(makeUser('SUPER_ADMIN', null))).toBe(false);
  });

  it('canAccessTenant: platform admin can access any tenant', () => {
    const platformAdmin = makeUser('SUPER_ADMIN', null);
    expect(canAccessTenant(platformAdmin, 'tenant-abc')).toBe(true);
    expect(canAccessTenant(platformAdmin, 'tenant-xyz')).toBe(true);
    expect(canAccessTenant(platformAdmin, null)).toBe(true);
  });

  it('canAccessTenant: tenant admin can ONLY access their own tenant', () => {
    const tenantAdmin = makeUser('SUPER_ADMIN', 'tenant-abc');
    expect(canAccessTenant(tenantAdmin, 'tenant-abc')).toBe(true);
    expect(canAccessTenant(tenantAdmin, 'tenant-xyz')).toBe(false);
    expect(canAccessTenant(tenantAdmin, null)).toBe(false);
  });
});

describe('Multi-Tenant Isolation — TenantPrisma proxy', () => {
  it('injects tenantId into findMany WHERE for tenant client', async () => {
    const prisma = require('@/lib/prisma').default;
    const spy = jest.spyOn(prisma.paymentChannel, 'findMany');
    spy.mockResolvedValue([]);

    const db = getTenantClient('tenant-abc');
    await db.paymentChannel.findMany({});

    // The proxy should have injected tenantId into the where clause
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' }),
      })
    );
  });

  it('does NOT inject tenantId for platform super admin (null)', async () => {
    const prisma = require('@/lib/prisma').default;
    const spy = jest.spyOn(prisma.paymentChannel, 'findMany');
    spy.mockResolvedValue([]);

    const db = getTenantClient(null);
    await db.paymentChannel.findMany({});

    // Platform admin: tenantId should NOT be injected (full cross-tenant access)
    const callArgs = spy.mock.calls[0]?.[0] as any;
    expect(callArgs?.where?.tenantId).toBeUndefined();
  });

  it('overwrites any tenantId the caller provides to prevent spoofing', async () => {
    const prisma = require('@/lib/prisma').default;
    const spy = jest.spyOn(prisma.paymentChannel, 'findMany');
    spy.mockResolvedValue([]);

    const db = getTenantClient('tenant-abc');
    // Caller tries to spoof tenantId='tenant-xyz'
    await db.paymentChannel.findMany({ where: { tenantId: 'tenant-xyz' } });

    // Proxy should have overwritten it with the real tenantId
    const callArgs = spy.mock.calls[0]?.[0] as any;
    expect(callArgs?.where?.tenantId).toBe('tenant-abc');
    expect(callArgs?.where?.tenantId).not.toBe('tenant-xyz');
  });
});

describe('Multi-Tenant Isolation — PaymentChannel cross-tenant prevention', () => {
  let svc: PaymentService;

  beforeEach(() => {
    svc = new PaymentService();
    jest.clearAllMocks();
  });

  it('Tenant A cannot use Tenant B\'s payment channel', async () => {
    const prisma = require('@/lib/prisma').default;
    // Tenant B's channel in DB — the proxy query must still filter by tenant-a
    prisma.paymentChannel.findFirst.mockResolvedValue({
      id: 'ch-tenant-b',
      tenantId: 'tenant-b',
      provider: 'PALMPESA',
      status: 'ACTIVE',
    });

    await svc.getChannel('tenant-a', 'PALMPESA', 'TENANT');

    const callArgs = (prisma.paymentChannel.findFirst as jest.Mock).mock.calls[0]?.[0];
    // The WHERE clause must filter by tenant-a, never tenant-b
    expect(callArgs?.where?.tenantId).toBe('tenant-a');
    expect(callArgs?.where?.tenantId).not.toBe('tenant-b');
  });

  it('Platform channel (tenantId=null) query never includes a tenantId value', async () => {
    const prisma = require('@/lib/prisma').default;
    prisma.paymentChannel.findFirst.mockResolvedValue({
      id: 'ch-tenant-abc',
      tenantId: 'tenant-abc',
      provider: 'PALMPESA',
      status: 'ACTIVE',
    });

    await svc.getChannel(null, 'PALMPESA', 'LICENSE');

    const callArgs = (prisma.paymentChannel.findFirst as jest.Mock).mock.calls[0]?.[0];
    expect(callArgs?.where?.tenantId).toBeNull();
  });
});

describe('Multi-Tenant Isolation — Webhook cannot activate cross-tenant invoice', () => {
  it('processWebhook transaction query includes tenantId filter', async () => {
    const prisma = require('@/lib/prisma').default;
    const { getPaymentProvider } = require('@/lib/payments/registry');
    (getPaymentProvider as jest.Mock).mockReturnValue({
      verifyWebhook: jest.fn().mockResolvedValue({ verified: true }),
      parseWebhookPayload: jest.fn().mockReturnValue({
        transactionRef: 'HP-AABBCCDD',
        resultCode: '0',
        amount: 5000,
      }),
    });

    // Simulate cross-tenant scenario: transaction not found in tenant-abc's scope
    prisma.paymentChannel.findFirst.mockResolvedValue({
      id: 'ch-tenant-abc',
      tenantId: 'tenant-abc',
      provider: 'PALMPESA',
      status: 'ACTIVE',
    });
    prisma.transaction.findFirst.mockResolvedValue(null);
    prisma.tenantInvoice.findFirst.mockResolvedValue(null);
    prisma.tenantPayment.findFirst.mockResolvedValue(null);
    prisma.webhookLog.create.mockResolvedValue({ id: 'wl-1' });
    prisma.webhookLog.findFirst.mockResolvedValue({ id: 'wl-1' }); // ownership check
    prisma.webhookLog.update.mockResolvedValue({});

    const svc = new PaymentService();
    const result = await svc.processWebhook('PALMPESA', {}, '{}', 'tenant-abc');

    expect(result.processed).toBe(false);
    expect(result.message).toBe('Transaction not found');

    // Verify the transaction query filtered by tenantId='tenant-abc'
    const txQuery = (prisma.transaction.findFirst as jest.Mock).mock.calls[0]?.[0];
    expect(txQuery?.where?.tenantId).toBe('tenant-abc');
  });
});
