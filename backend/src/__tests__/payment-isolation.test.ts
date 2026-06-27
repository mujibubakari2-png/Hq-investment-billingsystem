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
    findFirst:        jest.fn().mockResolvedValue(null),
    findMany:         jest.fn().mockResolvedValue([]),
    findUnique:       jest.fn().mockResolvedValue(null),
    findFirstOrThrow: jest.fn().mockResolvedValue(null),
    updateMany:       jest.fn().mockResolvedValue({ count: 0 }),
    update:           jest.fn().mockResolvedValue({ id: 'mock-id' }),
    create:           jest.fn().mockResolvedValue({ id: 'mock-id' }),
    createMany:       jest.fn().mockResolvedValue({ count: 0 }),
    delete:           jest.fn().mockResolvedValue({}),
    deleteMany:       jest.fn().mockResolvedValue({ count: 0 }),
    count:            jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    paymentChannel: mkModel(),
    transaction:    mkModel(),
    webhookLog:     mkModel({ create: jest.fn().mockResolvedValue({ id: 'wl-001' }) }),
    subscription:   mkModel(),
    client:         mkModel(),
    package:        mkModel(),
    routerLog:      mkModel(),
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

import { PaymentService, PaymentContext } from '@/lib/payments/service';

describe('PaymentService.getChannel — Credential Isolation (CRITICAL-1)', () => {
  let svc: PaymentService;

  beforeEach(() => {
    svc = new PaymentService();
    jest.clearAllMocks();
  });

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

describe('PaymentService — Channel isolation: no platform channel for hotspot', () => {
  it('Platform channels (tenantId=null) are never returned for TENANT context queries', async () => {
    const prismaMock = require('@/lib/prisma').default;
    // Even if the DB has a matching provider with tenantId=null,
    // TENANT context should NEVER find it (the query filters by tenantId='tenant-abc')
    prismaMock.paymentChannel.findFirst.mockResolvedValue(null); // No tenant channel found

    const svc = new PaymentService();
    const channel = await svc.getChannel('tenant-abc', 'PALMPESA', 'TENANT');

    // findFirst was called with tenantId='tenant-abc' — not null
    const callArgs = (prismaMock.paymentChannel.findFirst as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe('tenant-abc');
    expect(callArgs.where.tenantId).not.toBeNull();

    // Result is null (no tenant channel configured) — not the platform channel
    expect(channel).toBeNull();
  });
});
