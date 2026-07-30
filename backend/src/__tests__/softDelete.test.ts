/**
 * softDelete utility unit tests
 *
 * Tests: isSoftDeleted, notDeleted, onlyDeleted (pure logic — no DB calls).
 * softDelete() / restore() / purgeOldSoftDeleted() are covered by mocking getTenantClient.
 */

// ── Mock getTenantClient so no real DB is needed ──────────────────────────────
const mockUpdate   = jest.fn();
const mockDeleteMany = jest.fn();

const mockDb: any = {
    client:       { update: mockUpdate, deleteMany: mockDeleteMany },
    user:         { update: mockUpdate, deleteMany: mockDeleteMany },
    subscription: { update: mockUpdate, deleteMany: mockDeleteMany },
    router:       { update: mockUpdate, deleteMany: mockDeleteMany },
    package:      { update: mockUpdate, deleteMany: mockDeleteMany },
    transaction:  { update: mockUpdate, deleteMany: mockDeleteMany },
};

jest.mock('../lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(() => mockDb),
}));

// Also mock prisma so the module can be imported without a real DB connection
jest.mock('../lib/prisma', () => ({
    __esModule: true,
    default: {
        $extends: jest.fn().mockReturnValue({}),
    },
}));

import {
    softDelete, restore, isSoftDeleted,
    notDeleted, onlyDeleted, purgeOldSoftDeleted,
    type SoftDeletableModel,
} from '../lib/softDelete';

// ── Pure helpers ──────────────────────────────────────────────────────────────
describe('isSoftDeleted', () => {
    it('returns true when deletedAt is a Date', () => {
        expect(isSoftDeleted({ deletedAt: new Date() })).toBe(true);
    });

    it('returns false when deletedAt is null', () => {
        expect(isSoftDeleted({ deletedAt: null })).toBe(false);
    });

    it('returns false when deletedAt is undefined', () => {
        expect(isSoftDeleted({ deletedAt: undefined })).toBe(false);
    });
});

describe('notDeleted', () => {
    it('returns where clause that filters deletedAt = null', () => {
        expect(notDeleted()).toEqual({ deletedAt: null });
    });
});

describe('onlyDeleted', () => {
    it('returns where clause that selects records with deletedAt set', () => {
        expect(onlyDeleted()).toEqual({ deletedAt: { not: null } });
    });
});

// ── softDelete() ──────────────────────────────────────────────────────────────
describe('softDelete', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls prisma update with deletedAt = now and returns result', async () => {
        const now = new Date();
        mockUpdate.mockResolvedValue({ id: 'client-1', deletedAt: now });

        const result = await softDelete('client', 'client-1', 'tenant-1');

        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: 'client-1' }),
            data: { deletedAt: expect.any(Date) },
            select: { id: true, deletedAt: true },
        }));
        expect(result?.deletedAt).toBeInstanceOf(Date);
    });

    it('returns null when record is not found (P2025)', async () => {
        const p2025 = Object.assign(new Error('Not found'), { code: 'P2025' });
        mockUpdate.mockRejectedValue(p2025);

        const result = await softDelete('client', 'nonexistent', 'tenant-1');
        expect(result).toBeNull();
    });

    it('rethrows non-P2025 errors', async () => {
        mockUpdate.mockRejectedValue(new Error('DB connection lost'));

        await expect(softDelete('client', 'client-1', 'tenant-1')).rejects.toThrow('DB connection lost');
    });

    it('throws for unsupported model', async () => {
        await expect(
            softDelete('invoice' as SoftDeletableModel, 'x', 'tenant-1')
        ).rejects.toThrow(/not supported/i);
    });
});

// ── restore() ─────────────────────────────────────────────────────────────────
describe('restore', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls prisma update with deletedAt = null', async () => {
        mockUpdate.mockResolvedValue({ id: 'client-1', deletedAt: null });

        const result = await restore('client', 'client-1', 'tenant-1');

        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: 'client-1' }),
            data: { deletedAt: null },
            select: { id: true, deletedAt: true },
        }));
        expect(result?.deletedAt).toBeNull();
    });

    it('returns null when record not found (P2025)', async () => {
        const p2025 = Object.assign(new Error('Not found'), { code: 'P2025' });
        mockUpdate.mockRejectedValue(p2025);

        expect(await restore('client', 'x', 'tenant-1')).toBeNull();
    });
});

// ── purgeOldSoftDeleted() ─────────────────────────────────────────────────────
describe('purgeOldSoftDeleted', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls deleteMany on all six models and returns counts', async () => {
        mockDeleteMany.mockResolvedValue({ count: 3 });

        const result = await purgeOldSoftDeleted(90);

        expect(result).toEqual({
            clients: 3, users: 3, subscriptions: 3,
            routers: 3, packages: 3, transactions: 3,
        });
    });

    it('uses a cutoff date older than daysOld', async () => {
        const captured: Date[] = [];
        mockDeleteMany.mockImplementation(({ where }: any) => {
            captured.push(where.deletedAt.lte);
            return Promise.resolve({ count: 0 });
        });

        const before = Date.now();
        await purgeOldSoftDeleted(30);
        const after = Date.now();

        const cutoff = captured[0];
        expect(cutoff).toBeInstanceOf(Date);
        expect(cutoff.getTime()).toBeLessThan(before - 29 * 24 * 60 * 60 * 1000);
        expect(cutoff.getTime()).toBeGreaterThan(after - 31 * 24 * 60 * 60 * 1000);
    });
});
