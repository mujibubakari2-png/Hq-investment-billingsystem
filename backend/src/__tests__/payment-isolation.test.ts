/// <reference types="jest" />
/// <reference types="node" />

/**
 * Payment Credential Isolation Tests
 *
 * Verifies that LICENSE-context payments only use platform (tenantId=null) channels
 * and TENANT-context payments only use tenant (tenantId=<value>) channels.
 *
 * CRITICAL-1 coverage: the hard isolation enforcement in PaymentService.getChannel()
 */

// ── Mock Prisma so tests don't need a live DB ──────────────────────────────
// ── Complete model factory — prevents tenantPrisma proxy ownership-check failures
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

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    paymentChannel: mkModel(),
    transaction: mkModel(),
    webhookLog: mkModel({ create: jest.fn().mockResolvedValue({ id: 'wl-001' }) }),
    subscription: mkModel(),
    client: mkModel(),
    package: mkModel(),
    routerLog: mkModel(),
    tenantInvoice: mkModel(),
    tenantPayment: mkModel(),
    $transaction: jest.fn(async (fn: any) => fn({
      transaction: mkModel(),
      subscription: mkModel(),
      client: mkModel(),
      invoice: mkModel(),
    })),
  },
}));

jest.mock('@/lib/payments/registry', () => ({
  getPaymentProvider: jest.fn(() => ({
    name: 'PALMPESA',
    initiatePayment: jest.fn().mockResolvedValue({ success: true, message: 'OK', providerRef: 'ref-001' }),
    checkStatus: jest.fn(),
    verifyWebhook: jest.fn(),
    parseWebhookPayload: jest.fn(),
  })),
  isSupportedProvider: jest.fn(() => true),
}));

import { PaymentService, PaymentContext } from '../lib/payments/service';

describe('PaymentService.getChannel — Credential Isolation (CRITICAL-1)', () => {
  let svc: PaymentService;

  beforeEach(() => {
    svc = new PaymentService();
    jest.clearAllMocks();
  });

  it.each(['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'] as const)(
    'uses a platform channel for LICENSE payments with provider %s',
    async (provider) => {
      const prismaMock = require('@/lib/prisma').default;
      prismaMock.paymentChannel.findFirst.mockResolvedValue({
        id: `ch-platform-${provider}`,
        provider,
        tenantId: null,
        status: 'ACTIVE',
      });

      const channel = await svc.getChannel(null, provider, 'LICENSE');

      expect(channel?.tenantId).toBeNull();
      expect(prismaMock.paymentChannel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: null, provider }) })
      );
    }
  );

  it.each(['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'] as const)(
    'uses a tenant channel for TENANT payments with provider %s',
    async (provider) => {
      const prismaMock = require('@/lib/prisma').default;
      prismaMock.paymentChannel.findFirst.mockResolvedValue({
        id: `ch-tenant-${provider}`,
        provider,
        tenantId: 'tenant-abc',
        status: 'ACTIVE',
      });

      const channel = await svc.getChannel('tenant-abc', provider, 'TENANT');

      expect(channel?.tenantId).toBe('tenant-abc');
      expect(prismaMock.paymentChannel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-abc', provider }) })
      );
    }
  );

  // ── LICENSE context checks ──────────────────────────────────────────────

  it('LICENSE context: resolves platform channel when tenantId=null', async () => {
    const prismaMock = require('@/lib/prisma').default;
    prismaMock.paymentChannel.findFirst.mockResolvedValue({
      id: 'ch-platform-1',
      provider: 'PALMPESA',
      tenantId: null,
      status: 'ACTIVE',
      apiKey: 'encrypted-platform-key',
    });

    const channel = await svc.getChannel(null, 'PALMPESA', 'LICENSE');
    expect(channel?.tenantId).toBeNull();
    expect(prismaMock.paymentChannel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: null }) })
    );
  });

  it('LICENSE context: throws when tenantId is provided (ISOLATION VIOLATION)', async () => {
    await expect(
      svc.getChannel('tenant-abc', 'PALMPESA', 'LICENSE')
    ).rejects.toThrow('[PAYMENT ISOLATION VIOLATION]');

    await expect(
      svc.getChannel('tenant-abc', 'PALMPESA', 'LICENSE')
    ).rejects.toThrow('Platform credentials must never be used for Hotspot or PPPoE payments');
  });

  // ── TENANT context checks ───────────────────────────────────────────────

  it('TENANT context: resolves tenant channel when tenantId is provided', async () => {
    const prismaMock = require('@/lib/prisma').default;
    prismaMock.paymentChannel.findFirst.mockResolvedValue({
      id: 'ch-tenant-1',
      provider: 'PALMPESA',
      tenantId: 'tenant-abc',
      status: 'ACTIVE',
      apiKey: 'encrypted-tenant-key',
    });

    const channel = await svc.getChannel('tenant-abc', 'PALMPESA', 'TENANT');
    expect(channel?.tenantId).toBe('tenant-abc');
  });

  it('TENANT context: throws when tenantId=null (ISOLATION VIOLATION)', async () => {
    await expect(
      svc.getChannel(null, 'PALMPESA', 'TENANT')
    ).rejects.toThrow('[PAYMENT ISOLATION VIOLATION]');

    await expect(
      svc.getChannel(null, 'PALMPESA', 'TENANT')
    ).rejects.toThrow('Tenant credentials must never be used for License payments');
  });

  // ── Auto-detection from tenantId (no explicit context) ─────────────────

  it('Auto-detects LICENSE context when tenantId=null', async () => {
    const prismaMock = require('@/lib/prisma').default;
    prismaMock.paymentChannel.findFirst.mockResolvedValue({ id: 'ch-1', tenantId: null });
    // Should NOT throw — auto-detection sees null → LICENSE
    await expect(svc.getChannel(null, 'PALMPESA')).resolves.toBeDefined();
  });

  it('Auto-detects TENANT context when tenantId is provided', async () => {
    const prismaMock = require('@/lib/prisma').default;
    prismaMock.paymentChannel.findFirst.mockResolvedValue({ id: 'ch-2', tenantId: 'tenant-abc' });
    // Should NOT throw — auto-detection sees tenantId → TENANT
    await expect(svc.getChannel('tenant-abc', 'PALMPESA')).resolves.toBeDefined();
  });

  // ── Cross-contamination: same provider, different contexts ──────────────

  it('Same provider name cannot be used across both contexts', async () => {
    // Platform PALMPESA channel
    const platformCall = svc.getChannel(null, 'PALMPESA', 'LICENSE');
    // Tenant PALMPESA channel — same provider name, different tenantId
    const tenantCall = svc.getChannel('tenant-abc', 'PALMPESA', 'TENANT');

    // Neither should throw (valid contexts)
    await expect(platformCall).resolves.not.toThrow();
    await expect(tenantCall).resolves.not.toThrow();

    // Both should be isolated from each other by the tenantId filter
    const calls = (require('@/lib/prisma').default.paymentChannel.findFirst as jest.Mock).mock.calls;
    const platformFilter = calls[0][0].where;
    const tenantFilter = calls[1][0].where;

    expect(platformFilter.tenantId).toBeNull();
    expect(tenantFilter.tenantId).toBe('tenant-abc');
  });
});

describe('PaymentService — Channel isolation: no platform channel for tenant payments', () => {
  it.each(['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'] as const)(
    'never returns a platform channel for TENANT context with provider %s',
    async (provider) => {
      const prismaMock = require('@/lib/prisma').default;
      prismaMock.paymentChannel.findFirst.mockResolvedValue(null);

      const svc = new PaymentService();
      const channel = await svc.getChannel('tenant-abc', provider, 'TENANT');

      const callArgs = (prismaMock.paymentChannel.findFirst as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe('tenant-abc');
      expect(callArgs.where.tenantId).not.toBeNull();
      expect(channel).toBeNull();
    }
  );

  it.each(['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'] as const)(
    'never returns a tenant channel for LICENSE context with provider %s',
    async (provider) => {
      const prismaMock = require('@/lib/prisma').default;
      prismaMock.paymentChannel.findFirst.mockResolvedValue(null);

      const svc = new PaymentService();
      const channel = await svc.getChannel(null, provider, 'LICENSE');

      const callArgs = (prismaMock.paymentChannel.findFirst as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.tenantId).toBeNull();
      expect(channel).toBeNull();
    }
  );
});

describe('PaymentService.initiatePayment — explicit production context', () => {
  it.each(['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'] as const)(
    'uses LICENSE context for license payments and SaaS renewals with provider %s',
    async (provider) => {
      const svc = new PaymentService();
      const getChannelSpy = jest.spyOn(svc, 'getChannel').mockResolvedValue({ id: `ch-license-${provider}` } as any);
      const providerMock = {
        initiatePayment: jest.fn().mockResolvedValue({ success: true, message: 'OK', providerRef: `ref-${provider}` }),
      };
      const registry = require('@/lib/payments/registry');
      (registry.getPaymentProvider as jest.Mock).mockReturnValue(providerMock);

      await svc.initiatePayment({
        tenantId: null,
        amount: 1000,
        phone: '0712345678',
        providerName: provider,
        paymentContext: 'LICENSE',
      } as any);

      expect(getChannelSpy).toHaveBeenCalledWith(null, provider, 'LICENSE');
      expect(providerMock.initiatePayment).toHaveBeenCalled();
    }
  );

  it.each(['PALMPESA', 'ZENOPAY', 'MONGIKE', 'HARAKAPAY'] as const)(
    'uses TENANT context for customer STK push, hotspot purchases, and PPPoE purchases with provider %s',
    async (provider) => {
      const svc = new PaymentService();
      const getChannelSpy = jest.spyOn(svc, 'getChannel').mockResolvedValue({ id: `ch-tenant-${provider}` } as any);
      const providerMock = {
        initiatePayment: jest.fn().mockResolvedValue({ success: true, message: 'OK', providerRef: `ref-${provider}` }),
      };
      const registry = require('@/lib/payments/registry');
      (registry.getPaymentProvider as jest.Mock).mockReturnValue(providerMock);

      await svc.initiatePayment({
        tenantId: 'tenant-abc',
        amount: 2000,
        phone: '0712345678',
        providerName: provider,
        paymentContext: 'TENANT',
      } as any);

      expect(getChannelSpy).toHaveBeenCalledWith('tenant-abc', provider, 'TENANT');
      expect(providerMock.initiatePayment).toHaveBeenCalled();
    }
  );
});

describe('PaymentService.processWebhook — Route Fallback Isolation', () => {
  it('Tenant webhook with skipLicense=true should NEVER query license invoices', async () => {
    const prismaMock = require('@/lib/prisma').default;
    const svc = new PaymentService();
    // Bypass verification
    const registry = require('@/lib/payments/registry');
    registry.getPaymentProvider.mockReturnValue({
      verifyWebhook: jest.fn().mockResolvedValue({ verified: true }),
      parseWebhookPayload: jest.fn().mockReturnValue({ transactionRef: 'TENANT-REF', providerRef: 'P-REF', resultCode: '0' }),
    });

    // Mock getChannel to avoid errors
    jest.spyOn(svc, 'getChannel').mockResolvedValue({ id: 'ch' } as any);

    // Call processWebhook
    await svc.processWebhook('PALMPESA', {}, '{}', 'tenant-123', { skipLicense: true });

    // Ensure it queried transaction table
    expect(prismaMock.transaction.findFirst).toHaveBeenCalled();
    // Ensure it NEVER queried tenantInvoice
    expect(prismaMock.tenantInvoice.findFirst).not.toHaveBeenCalled();
  });

  it('Platform webhook with skipTenant=true should NEVER query tenant transactions', async () => {
    const prismaMock = require('@/lib/prisma').default;
    // Clear mocks from previous test
    jest.clearAllMocks();

    const svc = new PaymentService();
    const registry = require('@/lib/payments/registry');
    registry.getPaymentProvider.mockReturnValue({
      verifyWebhook: jest.fn().mockResolvedValue({ verified: true }),
      parseWebhookPayload: jest.fn().mockReturnValue({ transactionRef: 'LICENSE-REF', providerRef: 'P-REF', resultCode: '0' }),
    });

    jest.spyOn(svc, 'getChannel').mockResolvedValue({ id: 'ch' } as any);

    await svc.processWebhook('PALMPESA', {}, '{}', null, { skipTenant: true });

    // Ensure it NEVER queried transaction table
    expect(prismaMock.transaction.findFirst).not.toHaveBeenCalled();
    // Ensure it queried tenantInvoice table
    expect(prismaMock.tenantInvoice.findFirst).toHaveBeenCalled();
  });
});

