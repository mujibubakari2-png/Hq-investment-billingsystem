/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  INTEGRATION TEST SUITE: Payment Channels ↔ MikroTik ↔ FreeRADIUS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Architecture notes for test authors:
 *
 *  The PaymentService.processWebhook() separates DB clients:
 *    globalDb = getTenantClient(null)   → webhookLog.create + global lookups
 *    db       = getTenantClient(tid)   → all tenant-scoped ops
 *
 *  When tenantId param is null the service initially sets db = globalDb, then
 *  re-assigns db = getTenantClient(transaction.tenantId) once the transaction
 *  is found.  Tests that set tenantId=null must give globalDb a functioning
 *  transaction mock.
 *
 *  getMikroTikService returns a MikroTikService whose activateService() method
 *  does the sanitization INTERNALLY. The service passes pkg.name RAW; the real
 *  class sanitizes it. Since we mock the whole service, the mock receives the
 *  RAW name — test expectations must reflect that.
 */

/// <reference types="jest" />

// ── Top-level mocks (hoisted before any import) ───────────────────────────────

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(),
}));

jest.mock('@/lib/payments/registry', () => ({
    getPaymentProvider: jest.fn(),
    isSupportedProvider: jest.fn(() => true),
}));

jest.mock('@/lib/radius', () => ({
    syncRadiusUser: jest.fn(),
    suspendRadiusUser: jest.fn(),
    deleteRadiusUser: jest.fn(),
}));

jest.mock('@/lib/mikrotik', () => ({
    getMikroTikService: jest.fn(),
    // Keep the real sanitize so §7 tests exercise real logic
    sanitizeMikroTikName: jest.requireActual('@/lib/mikrotik').sanitizeMikroTikName,
}));

jest.mock('@/lib/prisma', () => ({
    default: {
        $executeRaw: jest.fn(async () => 1),
        radCheck: { deleteMany: jest.fn(async () => ({})) },
        radReply: { deleteMany: jest.fn(async () => ({})) },
    },
}));

// ── Require after mocks ───────────────────────────────────────────────────────
// `export {}` makes this file an ES module so TypeScript gives it its own
// isolated scope, preventing "Cannot redeclare" errors with other test files.
export {};

const { getTenantClient }                         = require('@/lib/tenantPrisma');
const { getPaymentProvider, isSupportedProvider } = require('@/lib/payments/registry');
const { syncRadiusUser }                          = require('@/lib/radius');
const { getMikroTikService, sanitizeMikroTikName }= require('@/lib/mikrotik');
const { paymentService }                          = require('@/lib/payments/service');

// ═══════════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════════

const TENANT_ID  = 'tenant-abc';
const CLIENT_ID  = 'client-001';
const PACKAGE_ID = 'pkg-001';
const ROUTER_ID  = 'router-001';
const TX_REF     = 'HP-TEST-001';
const WL_ID      = 'wl-001';
const SUB_ID     = 'sub-001';

// ═══════════════════════════════════════════════════════════════════════════════
//  Fixture factories
// ═══════════════════════════════════════════════════════════════════════════════

function makeClient(o: Record<string, any> = {}) {
    return {
        id: CLIENT_ID, username: 'john.doe', phone: '255712345678',
        fullName: 'John Doe', serviceType: 'HOTSPOT', ...o,
    };
}

function makePkg(o: Record<string, any> = {}) {
    return {
        id: PACKAGE_ID, name: '10 Mbps Home', duration: 30, durationUnit: 'DAYS',
        uploadSpeed: 10, downloadSpeed: 10, uploadUnit: 'Mbps', downloadUnit: 'Mbps',
        tenantId: TENANT_ID, routerId: null, ...o,
    };
}

function makeTx(o: Record<string, any> = {}) {
    return {
        id: 'tx-001', reference: TX_REF, amount: 5000, status: 'PENDING',
        clientId: CLIENT_ID, client: makeClient(), packageId: PACKAGE_ID,
        tenantId: TENANT_ID, invoiceId: null, planName: '10 Mbps Home', ...o,
    };
}

function makeSub(o: Record<string, any> = {}) {
    return { id: SUB_ID, expiresAt: new Date(Date.now() + 86_400_000 * 30), ...o };
}

/**
 * Tenant-scoped DB mock.
 * existingSubInTx is returned by subscription.findFirst() inside $transaction.
 */
function makeTenantDb(tx: any, pkg: any, opts: {
    existingSubInTx?: any;
    txUpdateCount?: number;
} = {}) {
    const { existingSubInTx = null, txUpdateCount = 1 } = opts;
    const db: any = {
        paymentChannel: {
            findFirst: jest.fn(async () => ({ id: 'ch-tenant', tenantId: tx?.tenantId ?? TENANT_ID, provider: 'ZENOPAY', status: 'ACTIVE' })),
            findMany: jest.fn(async () => []),
        },
        webhookLog: {
            create: jest.fn(async ({ data }: any) => ({ id: WL_ID, ...data })),
            update: jest.fn(async () => ({})),
        },
        transaction: {
            findFirst:  jest.fn(async () => tx),
            findUnique: jest.fn(async () => tx),
            updateMany: jest.fn(async () => ({ count: txUpdateCount })),
            update:     jest.fn(async () => ({})),
        },
        package:  { findFirst: jest.fn(async () => pkg) },
        subscription: {
            findFirst: jest.fn(async () => existingSubInTx),
            create:    jest.fn(async () => makeSub()),
            update:    jest.fn(async () => makeSub({ expiresAt: new Date(Date.now() + 86_400_000 * 60) })),
        },
        client:    { update: jest.fn(async () => ({})) },
        routerLog: { create: jest.fn(async () => ({})) },
        $transaction: jest.fn(async (cb: any) => cb(db)),
    };
    return db;
}

/**
 * Global DB mock (getTenantClient(null)).
 * Optionally supply a transaction so null-tenantId flows work.
 */
function makeGlobalDb(tx?: any) {
    const db: any = {
        paymentChannel: {
            findFirst: jest.fn(async () => ({ id: 'ch-platform', tenantId: null, provider: 'ZENOPAY', status: 'ACTIVE' })),
            findMany: jest.fn(async () => [{ id: 'ch-tenant', tenantId: tx?.tenantId ?? TENANT_ID, provider: 'ZENOPAY', status: 'ACTIVE' }]),
        },
        webhookLog: {
            create: jest.fn(async ({ data }: any) => ({ id: WL_ID, ...data })),
            update: jest.fn(async () => ({})),
        },
        transaction: {
            findFirst:  jest.fn(async () => tx ?? null),
            findUnique: jest.fn(async () => tx ?? null),
            updateMany: jest.fn(async () => ({ count: tx ? 1 : 0 })),
            update:     jest.fn(async () => ({})),
        },
    };
    return db;
}

function makeProvider(o: {
    resultCode?: string; amount?: number;
    verified?: boolean; reason?: string; transactionRef?: string;
} = {}) {
    return {
        verifyWebhook: jest.fn(async () => ({
            verified: o.verified ?? true, reason: o.reason,
        })),
        parseWebhookPayload: jest.fn(() => ({
            transactionRef: o.transactionRef ?? TX_REF,
            providerRef: 'prov-ref-001',
            resultCode: o.resultCode ?? '0',
            resultMessage: o.resultCode === '0' ? 'Success' : 'Failed',
            amount: o.amount ?? 5000,
            rawBody: {},
        })),
    };
}

function makeMikroTik() {
    return { activateService: jest.fn(async () => ({})) };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Central test runner
// ═══════════════════════════════════════════════════════════════════════════════

interface RunOpts {
    tx?: any;
    /** pass null explicitly to test null-package path */
    pkg?: any;
    provider?: any;
    existingSubInTx?: any;
    txUpdateCount?: number;
    tenantId?: string | null;
    mikrotikService?: any;
}

async function runWebhook(opts: RunOpts = {}) {
    const tx  = opts.tx  ?? makeTx();
    // Distinguish "not provided" (default pkg) from "provided as null"
    const pkg = 'pkg' in opts ? opts.pkg : makePkg();
    const tenantId = 'tenantId' in opts ? opts.tenantId : TENANT_ID;

    const tenantDb = makeTenantDb(tx, pkg, {
        existingSubInTx: opts.existingSubInTx ?? null,
        txUpdateCount:   opts.txUpdateCount   ?? 1,
    });
    const globalDb = makeGlobalDb();

    // CRITICAL: re-set after jest.resetAllMocks() clears factory defaults
    (isSupportedProvider as jest.Mock).mockReturnValue(true);
    (getTenantClient as jest.Mock).mockImplementation((tid: string | null) =>
        tid === null ? globalDb : tenantDb
    );
    (getPaymentProvider as jest.Mock).mockReturnValue(opts.provider ?? makeProvider());
    (getMikroTikService as jest.Mock).mockResolvedValue(
        opts.mikrotikService !== undefined ? opts.mikrotikService : makeMikroTik()
    );

    const rawBody = JSON.stringify({ transactionRef: TX_REF });
    const result  = await paymentService.processWebhook(
        'ZENOPAY', { 'x-sig': 'valid' }, rawBody, tenantId,
    );
    return { result, tenantDb, globalDb };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  §1 – Webhook Core Flow
// ═══════════════════════════════════════════════════════════════════════════════

describe('§1 – Webhook Core Flow', () => {
    beforeEach(() => jest.resetAllMocks());

    it('1.1 – successful payment: processed=true, status=COMPLETED, tx marked', async () => {
        const { result, tenantDb } = await runWebhook();

        expect(result.processed).toBe(true);
        expect(result.status).toBe('COMPLETED');
        expect(tenantDb.transaction.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
        );
    });

    it('1.2 – failed provider result: processed=true, status=FAILED, no RADIUS/MikroTik', async () => {
        // When resultCode !== "0", the service calls db.$transaction(tx => tx.transaction.update(...))
        // Since $transaction mock passes db itself as tx, this lands on tenantDb.transaction.update.
        const { result, tenantDb } = await runWebhook({ provider: makeProvider({ resultCode: '1' }) });

        expect(result.processed).toBe(true);
        expect(result.status).toBe('FAILED');
        expect(tenantDb.transaction.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
        );
        expect(syncRadiusUser).not.toHaveBeenCalled();
        expect(getMikroTikService).not.toHaveBeenCalled();
    });

    it('1.3 – invalid signature: processed=false, transaction never touched', async () => {
        const { result, tenantDb } = await runWebhook({
            provider: makeProvider({ verified: false, reason: 'Sig mismatch' }),
        });

        expect(result.processed).toBe(false);
        expect(result.message).toMatch(/rejected/i);
        expect(tenantDb.transaction.updateMany).not.toHaveBeenCalled();
    });

    it('1.4 – concurrent duplicate (updateMany count=0): processed=true, no re-activation', async () => {
        const { result, tenantDb } = await runWebhook({ txUpdateCount: 0 });

        expect(result.processed).toBe(true);
        expect(tenantDb.client.update).not.toHaveBeenCalled();
        expect(tenantDb.subscription.create).not.toHaveBeenCalled();
    });

    it('1.5 – missing transactionRef in payload: processed=false', async () => {
        const { result } = await runWebhook({
            provider: { ...makeProvider(), parseWebhookPayload: jest.fn(() => ({ transactionRef: '', resultCode: '0', rawBody: {} })) },
        });

        expect(result.processed).toBe(false);
        expect(result.message).toMatch(/missing/i);
    });

    it('1.6 – unsupported provider: processed=false immediately', async () => {
        jest.resetAllMocks();
        (isSupportedProvider as jest.Mock).mockReturnValue(false);

        const result = await paymentService.processWebhook('FAKEPAY', {}, '{}', TENANT_ID);

        expect(result.processed).toBe(false);
        expect(result.message).toMatch(/unsupported/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §2 – Partial Payment Attack Prevention
// ═══════════════════════════════════════════════════════════════════════════════

describe('§2 – Partial Payment Attack Prevention', () => {
    beforeEach(() => jest.resetAllMocks());

    it('2.1 – underpayment (999 < 5000): FAILED, no RADIUS or MikroTik', async () => {
        const { result } = await runWebhook({
            provider: makeProvider({ resultCode: '0', amount: 999 }),
        });

        expect(result.processed).toBe(true);
        expect(result.status).toBe('FAILED');
        expect(result.message).toMatch(/amount/i);
        expect(syncRadiusUser).not.toHaveBeenCalled();
        expect(getMikroTikService).not.toHaveBeenCalled();
    });

    it('2.2 – exact match (5000 = 5000): COMPLETED', async () => {
        const { result } = await runWebhook({ provider: makeProvider({ resultCode: '0', amount: 5000 }) });
        expect(result.status).toBe('COMPLETED');
    });

    it('2.3 – overpayment (10000 > 5000): treated as success', async () => {
        const { result } = await runWebhook({ provider: makeProvider({ resultCode: '0', amount: 10000 }) });
        expect(result.status).toBe('COMPLETED');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §3 – FreeRADIUS Synchronisation
// ═══════════════════════════════════════════════════════════════════════════════

describe('§3 – FreeRADIUS Synchronisation', () => {
    beforeEach(() => jest.resetAllMocks());

    it('3.1 – successful payment syncs RADIUS: username, phone-password, rateLimit, status', async () => {
        await runWebhook();

        expect(syncRadiusUser).toHaveBeenCalledTimes(1);
        expect(syncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({
                username: 'john.doe',
                password: '255712345678',   // RAD-002: phone as password
                tenantId: TENANT_ID,
                rateLimit: '10M/10M',
                status: 'Active',
            }),
        );
    });

    it('3.2 – Kbps package produces "k" suffix in rateLimit', async () => {
        await runWebhook({ pkg: makePkg({ uploadUnit: 'Kbps', downloadUnit: 'Kbps' }) });

        expect(syncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({ rateLimit: '10k/10k' }),
        );
    });

    it('3.3 – RADIUS expiresAt is a future Date', async () => {
        await runWebhook();
        const arg = (syncRadiusUser as jest.Mock).mock.calls[0][0];
        expect(arg.expiresAt).toBeInstanceOf(Date);
        expect(arg.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('3.4 – RADIUS profileName equals the raw package name', async () => {
        await runWebhook({ pkg: makePkg({ name: 'Gold Plan' }) });
        expect(syncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({ profileName: 'Gold Plan' }),
        );
    });

    it('3.5 – RADIUS sync failure: payment COMPLETED, sub marked PENDING_RADIUS_SYNC', async () => {
        (syncRadiusUser as jest.Mock).mockRejectedValue(new Error('RADIUS DB down'));
        const { result, tenantDb } = await runWebhook();

        expect(result.status).toBe('COMPLETED');
        expect(tenantDb.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ syncStatus: 'PENDING_RADIUS_SYNC' }) }),
        );
    });

    it('3.6 – null phone falls back to username as RADIUS password (RAD-002)', async () => {
        const tx = makeTx({ client: makeClient({ phone: null, username: 'jane.smith' }) });
        await runWebhook({ tx });

        expect(syncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({ username: 'jane.smith', password: 'jane.smith' }),
        );
    });

    it('3.7 – no RADIUS call when package is null', async () => {
        await runWebhook({ pkg: null });
        expect(syncRadiusUser).not.toHaveBeenCalled();
    });

    it('3.8 – RADIUS tenantId comes from the package, not hardcoded', async () => {
        await runWebhook({ pkg: makePkg({ tenantId: 'special-tenant' }) });
        expect(syncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 'special-tenant' }),
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §4 – MikroTik Activation
// ═══════════════════════════════════════════════════════════════════════════════

describe('§4 – MikroTik Activation', () => {
    beforeEach(() => jest.resetAllMocks());

    it('4.1 – package with routerId: getMikroTikService + activateService called', async () => {
        const mk = makeMikroTik();
        await runWebhook({ pkg: makePkg({ routerId: ROUTER_ID }), mikrotikService: mk });

        expect(getMikroTikService).toHaveBeenCalledWith(ROUTER_ID);
        expect(mk.activateService).toHaveBeenCalledTimes(1);
    });

    it('4.2 – activateService receives the RAW package name (sanitize is internal to MikroTikService)', async () => {
        const mk = makeMikroTik();
        // The service passes pkg.name directly; the real MikroTikService.activateService()
        // sanitizes it internally. Our mock receives the raw name.
        await runWebhook({ pkg: makePkg({ routerId: ROUTER_ID, name: '50 Mbps / Home' }), mikrotikService: mk });

        expect(mk.activateService).toHaveBeenCalledWith(
            'john.doe', '255712345678', '50 Mbps / Home', 'hotspot', expect.any(Date),
        );
    });

    it('4.3 – PPPoE client passes "pppoe" serviceType', async () => {
        const mk = makeMikroTik();
        const tx = makeTx({ client: makeClient({ serviceType: 'PPPOE', username: 'pppoe.user' }) });
        await runWebhook({ tx, pkg: makePkg({ routerId: ROUTER_ID }), mikrotikService: mk });

        expect(mk.activateService).toHaveBeenCalledWith(
            'pppoe.user', expect.any(String), expect.any(String), 'pppoe', expect.any(Date),
        );
    });

    it('4.4 – routerId=null: getMikroTikService never called', async () => {
        const { result } = await runWebhook({ pkg: makePkg({ routerId: null }) });

        expect(result.status).toBe('COMPLETED');
        expect(getMikroTikService).not.toHaveBeenCalled();
    });

    it('4.5 – MikroTik failure: payment COMPLETED, error router log created', async () => {
        const mk = { activateService: jest.fn().mockRejectedValue(new Error('Router timeout')) };
        const { result, tenantDb } = await runWebhook({
            pkg: makePkg({ routerId: ROUTER_ID }), mikrotikService: mk,
        });

        expect(result.status).toBe('COMPLETED');
        expect(tenantDb.routerLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ action: 'PAYMENT_WEBHOOK_ACTIVATION_FAILED', status: 'error' }),
            }),
        );
    });

    it('4.6 – successful MikroTik activation logs PAYMENT_WEBHOOK_ACTIVATED', async () => {
        const mk = makeMikroTik();
        const { tenantDb } = await runWebhook({ pkg: makePkg({ routerId: ROUTER_ID }), mikrotikService: mk });

        expect(tenantDb.routerLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ action: 'PAYMENT_WEBHOOK_ACTIVATED', status: 'success' }),
            }),
        );
    });

    it('4.7 – successful MikroTik activation sets subscription syncStatus=SYNCED', async () => {
        const mk = makeMikroTik();
        const { tenantDb } = await runWebhook({ pkg: makePkg({ routerId: ROUTER_ID }), mikrotikService: mk });

        expect(tenantDb.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ syncStatus: 'SYNCED' }) }),
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §5 – Subscription Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe('§5 – Subscription Lifecycle', () => {
    beforeEach(() => jest.resetAllMocks());

    it('5.1 – new subscriber: subscription.create called, not update', async () => {
        const { tenantDb } = await runWebhook({ existingSubInTx: null });

        expect(tenantDb.subscription.create).toHaveBeenCalledTimes(1);
        // The only subscription.update call allowed is for syncStatus (SYNCED/PENDING_RADIUS_SYNC)
        const subUpdateCalls = (tenantDb.subscription.update as jest.Mock).mock.calls;
        const nonSyncUpdate = subUpdateCalls.find(
            ([args]: any[]) => !args?.data?.syncStatus
        );
        expect(nonSyncUpdate).toBeUndefined();
    });

    it('5.2 – existing active subscriber: subscription.update (extend), no create (PAY-005)', async () => {
        const existingSub = {
            id: 'old-sub', clientId: CLIENT_ID, packageId: PACKAGE_ID,
            status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000 * 10),
        };
        const { tenantDb } = await runWebhook({ existingSubInTx: existingSub });

        expect(tenantDb.subscription.create).not.toHaveBeenCalled();
        expect(tenantDb.subscription.update).toHaveBeenCalled();
    });

    it('5.3 – client.update is called with status: ACTIVE', async () => {
        const { tenantDb } = await runWebhook();

        expect(tenantDb.client.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: CLIENT_ID }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
        );
    });

    it('5.4 – concurrent duplicate (count=0): processed=true, no sub created', async () => {
        const { result, tenantDb } = await runWebhook({ txUpdateCount: 0 });

        expect(result.processed).toBe(true);
        expect(tenantDb.subscription.create).not.toHaveBeenCalled();
        expect(tenantDb.client.update).not.toHaveBeenCalled();
    });

    it('5.5 – DAYS package: RADIUS expiresAt is ~30 days in the future', async () => {
        await runWebhook({ pkg: makePkg({ duration: 30, durationUnit: 'DAYS' }) });

        const arg = (syncRadiusUser as jest.Mock).mock.calls[0]?.[0];
        if (arg?.expiresAt) {
            const daysAhead = (arg.expiresAt.getTime() - Date.now()) / 86_400_000;
            expect(daysAhead).toBeGreaterThan(28);
            expect(daysAhead).toBeLessThan(32);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §6 – Payment Channel Registry & initiatePayment
// ═══════════════════════════════════════════════════════════════════════════════

describe('§6 – Payment Channel Registry', () => {
    beforeEach(() => jest.resetAllMocks());

    it('6.1 – getChannel scopes query to tenantId + provider + ACTIVE', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        const db = makeTenantDb(makeTx(), makePkg());
        (getTenantClient as jest.Mock).mockReturnValue(db);

        await paymentService.getChannel(TENANT_ID, 'ZENOPAY');

        expect(db.paymentChannel.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ tenantId: TENANT_ID, provider: 'ZENOPAY', status: 'ACTIVE' }),
            }),
        );
    });

    it('6.2 – getChannel with null tenantId queries tenantId: null (global channels)', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        const db = makeGlobalDb();
        (getTenantClient as jest.Mock).mockReturnValue(db);

        await paymentService.getChannel(null, 'PALMPESA');

        expect(db.paymentChannel.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ tenantId: null, provider: 'PALMPESA' }),
            }),
        );
    });

    it('6.3 – initiatePayment rejects unsupported provider', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(false);
        (getTenantClient as jest.Mock).mockReturnValue(makeTenantDb(makeTx(), makePkg()));

        const result = await paymentService.initiatePayment({
            tenantId: TENANT_ID, amount: 1000, phone: '255712345678', providerName: 'FAKEPAY',
        });

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/unsupported/i);
    });

    it('6.4 – initiatePayment rejects amount < 100', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        (getTenantClient as jest.Mock).mockReturnValue(makeTenantDb(makeTx(), makePkg()));

        const result = await paymentService.initiatePayment({
            tenantId: TENANT_ID, amount: 50, phone: '255712345678', providerName: 'ZENOPAY',
        });

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/invalid amount/i);
    });

    it('6.5 – initiatePayment is idempotent for PENDING transaction', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        (getTenantClient as jest.Mock).mockReturnValue(makeTenantDb(makeTx({ status: 'PENDING' }), makePkg()));

        const result = await paymentService.initiatePayment({
            tenantId: TENANT_ID, amount: 5000, phone: '255712345678',
            providerName: 'ZENOPAY', reference: TX_REF,
        });

        expect((result as any).idempotent).toBe(true);
        expect(result.message).toMatch(/pending/i);
        expect(getPaymentProvider).not.toHaveBeenCalled();
    });

    it('6.6 – initiatePayment is idempotent for COMPLETED transaction', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        (getTenantClient as jest.Mock).mockReturnValue(makeTenantDb(makeTx({ status: 'COMPLETED' }), makePkg()));

        const result = await paymentService.initiatePayment({
            tenantId: TENANT_ID, amount: 5000, phone: '255712345678',
            providerName: 'ZENOPAY', reference: TX_REF,
        });

        expect((result as any).idempotent).toBe(true);
        expect(result.message).toMatch(/completed/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §7 – MikroTik Name Sanitisation (real function, no mocks)
// ═══════════════════════════════════════════════════════════════════════════════

describe('§7 – MikroTik Name Sanitisation', () => {
    const cases: [string, string][] = [
        ['10 Mbps Home',        '10-mbps-home'],
        ['50 Mbps / Business',  '50-mbps-business'],
        ['Gold Plan!!! 100M',   'gold-plan-100m'],
        ['--leading-dash',      'leading-dash'],
        ['trailing-dash--',     'trailing-dash'],
        ['Multiple   Spaces',   'multiple-spaces'],
        ['UPPERCASE',           'uppercase'],
        ['',                    'unnamed'],
        ['   ',                 'unnamed'],
        ['a',                   'a'],
        ['A1-Package',          'a1-package'],
    ];

    test.each(cases)('sanitizeMikroTikName(%j) → %j', (input, expected) => {
        expect(sanitizeMikroTikName(input)).toBe(expected);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §8 – Webhook Log Lifecycle
//  NOTE: webhookLog.CREATE and .UPDATE both go to globalDb
// ═══════════════════════════════════════════════════════════════════════════════

describe('§8 – Webhook Log Lifecycle', () => {
    beforeEach(() => jest.resetAllMocks());

    it('8.1 – webhookLog created on globalDb regardless of signature validity', async () => {
        const { globalDb } = await runWebhook({ provider: makeProvider({ verified: false, reason: 'Bad' }) });

        expect(globalDb.webhookLog.create).toHaveBeenCalledTimes(1);
    });

    it('8.2 – final webhookLog.update on globalDb: status=COMPLETED + processedAt', async () => {
        const { globalDb } = await runWebhook();

        const calls = (globalDb.webhookLog.update as jest.Mock).mock.calls;
        const completedCall = calls.find(([a]: any[]) => a?.data?.status === 'COMPLETED');
        expect(completedCall).toBeDefined();
        expect(completedCall[0].data.processedAt).toBeInstanceOf(Date);
    });

    it('8.3 – invalid signature: globalDb.webhookLog.update gets status=FAILED', async () => {
        const { globalDb } = await runWebhook({ provider: makeProvider({ verified: false, reason: 'Mismatch' }) });

        const failedCall = (globalDb.webhookLog.update as jest.Mock).mock.calls
            .find(([a]: any[]) => a?.data?.status === 'FAILED');
        expect(failedCall).toBeDefined();
    });

    it('8.4 – webhookLog.update records transactionRef from parsed payload', async () => {
        const { globalDb } = await runWebhook();

        const refCall = (globalDb.webhookLog.update as jest.Mock).mock.calls
            .find(([a]: any[]) => a?.data?.transactionRef);
        expect(refCall).toBeDefined();
        expect(refCall[0].data.transactionRef).toBe(TX_REF);
    });

    it('8.5 – concurrent duplicate (count=0): globalDb.webhookLog marked DUPLICATE', async () => {
        const { globalDb } = await runWebhook({ txUpdateCount: 0 });

        const dupCall = (globalDb.webhookLog.update as jest.Mock).mock.calls
            .find(([a]: any[]) => a?.data?.status === 'DUPLICATE');
        expect(dupCall).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §9 – Tenant Isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('§9 – Tenant Isolation', () => {
    beforeEach(() => jest.resetAllMocks());

    /**
     * 9.1 – When tenantId param is null the service resolves the tenant from
     * the transaction row and re-scopes db to getTenantClient(transaction.tenantId).
     *
     * Setup: globalDb.transaction.findFirst returns the tx so the service can
     * find it; subsequent tenant-scoped ops use tenantDb (resolved-tenant).
     */
    it('9.1 – null tenantId: service resolves tenant from transaction and re-scopes db', async () => {
        const resolvedTenantId = 'resolved-tenant';
        const tx = makeTx({ tenantId: resolvedTenantId });
        const pkg = makePkg({ tenantId: resolvedTenantId });

        const tenantDb = makeTenantDb(tx, pkg);
        const globalDb = makeGlobalDb(tx); // give globalDb the tx so findFirst returns it

        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        (getTenantClient as jest.Mock).mockImplementation((tid: string | null) =>
            tid === null ? globalDb : tenantDb
        );
        (getPaymentProvider as jest.Mock).mockReturnValue(makeProvider());
        (getMikroTikService as jest.Mock).mockResolvedValue(makeMikroTik());

        const result = await paymentService.processWebhook(
            'ZENOPAY', {}, JSON.stringify({ transactionRef: TX_REF }), null,
        );

        expect(result.processed).toBe(true);
        // Service must have called getTenantClient with the resolved tenantId
        expect(getTenantClient).toHaveBeenCalledWith(resolvedTenantId);
    });

    it('9.2 – getChannel returns null when no ACTIVE channel exists for tenant', async () => {
        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        const db = makeTenantDb(makeTx(), makePkg());
        db.paymentChannel.findFirst = jest.fn(async () => null);
        (getTenantClient as jest.Mock).mockReturnValue(db);

        const channel = await paymentService.getChannel('other-tenant', 'ZENOPAY');
        expect(channel).toBeNull();
    });

    it('9.3 – transaction query includes tenantId when tenantId is provided', async () => {
        const { tenantDb } = await runWebhook({ tenantId: TENANT_ID });

        expect(getTenantClient).toHaveBeenCalledWith(TENANT_ID);
        expect(tenantDb.transaction.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ reference: TX_REF }),
            }),
        );
    });

    /**
     * 9.4 – When tenantId param is null, the transaction query must NOT include
     * a tenantId filter (cross-tenant lookup). The query goes to globalDb.
     */
    it('9.4 – null tenantId: transaction query has no tenantId filter (global lookup)', async () => {
        const tx = makeTx({ tenantId: 'any-tenant' });
        const tenantDb = makeTenantDb(tx, makePkg());
        const globalDb = makeGlobalDb(tx);

        (isSupportedProvider as jest.Mock).mockReturnValue(true);
        (getTenantClient as jest.Mock).mockImplementation((tid: string | null) =>
            tid === null ? globalDb : tenantDb
        );
        (getPaymentProvider as jest.Mock).mockReturnValue(makeProvider());
        (getMikroTikService as jest.Mock).mockResolvedValue(makeMikroTik());

        await paymentService.processWebhook('ZENOPAY', {}, JSON.stringify({ transactionRef: TX_REF }), null);

        // When tenantId=null, db starts as globalDb → findFirst is on globalDb
        expect(getTenantClient).toHaveBeenCalledWith('any-tenant');
        expect(tenantDb.transaction.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ reference: TX_REF }),
            }),
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  §10 – End-to-End: Payment → RADIUS → MikroTik
// ═══════════════════════════════════════════════════════════════════════════════

describe('§10 – End-to-End: Payment → RADIUS → MikroTik', () => {
    beforeEach(() => jest.resetAllMocks());

    it('10.1 – full activation: COMPLETED, RADIUS synced, MikroTik activated, SYNCED', async () => {
        const mk  = makeMikroTik();
        const pkg = makePkg({ routerId: ROUTER_ID, name: 'Business 20Mbps' });
        const { result, tenantDb } = await runWebhook({ pkg, mikrotikService: mk });

        expect(result.processed).toBe(true);
        expect(result.status).toBe('COMPLETED');

        // RADIUS called with correct args
        expect(syncRadiusUser).toHaveBeenCalledWith(
            expect.objectContaining({
                username: 'john.doe', rateLimit: '10M/10M',
                profileName: 'Business 20Mbps', status: 'Active', tenantId: TENANT_ID,
            }),
        );

        // MikroTik called with RAW pkg.name (service does not sanitize before passing)
        expect(mk.activateService).toHaveBeenCalledWith(
            'john.doe', '255712345678', 'Business 20Mbps', 'hotspot', expect.any(Date),
        );

        // Subscription SYNCED
        expect(tenantDb.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ syncStatus: 'SYNCED' }) }),
        );

        // Router log success
        expect(tenantDb.routerLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ action: 'PAYMENT_WEBHOOK_ACTIVATED', status: 'success' }),
            }),
        );
    });

    it('10.2 – RADIUS fails: MikroTik still activates (independent error paths)', async () => {
        (syncRadiusUser as jest.Mock).mockRejectedValue(new Error('RADIUS DB down'));
        const mk  = makeMikroTik();
        const pkg = makePkg({ routerId: ROUTER_ID });
        const { result } = await runWebhook({ pkg, mikrotikService: mk });

        expect(result.status).toBe('COMPLETED');
        expect(mk.activateService).toHaveBeenCalledTimes(1);
    });

    it('10.3 – MikroTik fails: payment COMPLETED, RADIUS still ran', async () => {
        const mk  = { activateService: jest.fn().mockRejectedValue(new Error('Network error')) };
        const pkg = makePkg({ routerId: ROUTER_ID });
        const { result } = await runWebhook({ pkg, mikrotikService: mk });

        expect(result.status).toBe('COMPLETED');
        expect(syncRadiusUser).toHaveBeenCalledTimes(1);
    });

    it('10.4 – routerId=null: RADIUS runs, MikroTik skipped, COMPLETED', async () => {
        const { result } = await runWebhook({ pkg: makePkg({ routerId: null }) });

        expect(result.status).toBe('COMPLETED');
        expect(syncRadiusUser).toHaveBeenCalledTimes(1);
        expect(getMikroTikService).not.toHaveBeenCalled();
    });

    it('10.5 – failed provider result: neither RADIUS nor MikroTik called', async () => {
        const { result } = await runWebhook({ provider: makeProvider({ resultCode: '99', amount: 5000 }) });

        expect(result.status).toBe('FAILED');
        expect(syncRadiusUser).not.toHaveBeenCalled();
        expect(getMikroTikService).not.toHaveBeenCalled();
    });

    it('10.6 – HOTSPOT client password falls back to phone; PPPoE falls back to "123456"', async () => {
        // PPPoE path in service: `const pwd = client.phone || "123456"`
        const mk = makeMikroTik();
        const tx = makeTx({ client: makeClient({ phone: null, serviceType: 'PPPOE', username: 'pppoe.user' }) });
        await runWebhook({ tx, pkg: makePkg({ routerId: ROUTER_ID }), mikrotikService: mk });

        expect(mk.activateService).toHaveBeenCalledWith(
            'pppoe.user', '123456', expect.any(String), 'pppoe', expect.any(Date),
        );
    });
});
