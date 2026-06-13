/**
 * softDelete utility unit tests
 * 
 * Tests: isSoftDeleted, notDeleted, onlyDeleted (pure logic â€” no DB calls).
 * softDelete() / restore() / purgeOldSoftDeleted() are covered by mocking prisma.
 */

// â”€â”€ Mock prisma before importing the module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
jest.mock('../lib/prisma', () => ({
    __esModule: true,
    default: {
        client: {
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        user: {
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        subscription: {
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        router: {
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        package: {
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        transaction: {
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
    },
}));

import prismaMock from '../lib/prisma';
import {
    softDelete, restore, isSoftDeleted,
    notDeleted, onlyDeleted, purgeOldSoftDeleted,
    type SoftDeletableModel,
} from '../lib/softDelete';

// â”€â”€ Pure helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ softDelete() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('softDelete', () => {
    const mockUpdate = (prismaMock as any).client.update as jest.MockedFunction<any>;

    beforeEach(() => jest.clearAllMocks());

    it('calls prisma update with deletedAt = now and returns result', async () => {
        const now = new Date();
        mockUpdate.mockResolvedValue({ id: 'client-1', deletedAt: now });

        const result = await softDelete('client', 'client-1');

        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: 'client-1' },
            data: { deletedAt: expect.any(Date) },
            select: { id: true, deletedAt: true },
        });
        expect(result?.deletedAt).toBeInstanceOf(Date);
    });

    it('returns null when record is not found (P2025)', async () => {
        const p2025 = Object.assign(new Error('Not found'), { code: 'P2025' });
        mockUpdate.mockRejectedValue(p2025);

        const result = await softDelete('client', 'nonexistent');
        expect(result).toBeNull();
    });

    it('rethrows non-P2025 errors', async () => {
        mockUpdate.mockRejectedValue(new Error('DB connection lost'));

        await expect(softDelete('client', 'client-1')).rejects.toThrow('DB connection lost');
    });

    it('throws for unsupported model', async () => {
        await expect(
            softDelete('invoice' as SoftDeletableModel, 'x')
        ).rejects.toThrow(/not supported/i);
    });
});

// â”€â”€ restore() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('restore', () => {
    const mockUpdate = (prismaMock as any).client.update as jest.MockedFunction<any>;

    beforeEach(() => jest.clearAllMocks());

    it('calls prisma update with deletedAt = null', async () => {
        mockUpdate.mockResolvedValue({ id: 'client-1', deletedAt: null });

        const result = await restore('client', 'client-1');

        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: 'client-1' },
            data: { deletedAt: null },
            select: { id: true, deletedAt: true },
        });
        expect(result?.deletedAt).toBeNull();
    });

    it('returns null when record not found (P2025)', async () => {
        const p2025 = Object.assign(new Error('Not found'), { code: 'P2025' });
        mockUpdate.mockRejectedValue(p2025);

        expect(await restore('client', 'x')).toBeNull();
    });
});

// â”€â”€ purgeOldSoftDeleted() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('purgeOldSoftDeleted', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls deleteMany on all six models and returns counts', async () => {
        const mockCount = { count: 3 };
        const mockDelete = (model: string) =>
            ((prismaMock as any)[model].deleteMany as jest.MockedFunction<any>)
                .mockResolvedValue(mockCount);

        ['client', 'user', 'subscription', 'router', 'package', 'transaction']
            .forEach(mockDelete);

        const result = await purgeOldSoftDeleted(90);

        expect(result).toEqual({
            clients: 3, users: 3, subscriptions: 3,
            routers: 3, packages: 3, transactions: 3,
        });
    });

    it('uses a cutoff date older than daysOld', async () => {
        const captured: Date[] = [];
        const capturingMock = jest.fn().mockImplementation(({ where }: any) => {
            captured.push(where.deletedAt.lte);
            return Promise.resolve({ count: 0 });
        });

        ['client', 'user', 'subscription', 'router', 'package', 'transaction'].forEach(m => {
            (prismaMock as any)[m].deleteMany = capturingMock;
        });

        const before = Date.now();
        await purgeOldSoftDeleted(30);
        const after = Date.now();

        const cutoff = captured[0];
        expect(cutoff.getTime()).toBeLessThan(before - 29 * 24 * 60 * 60 * 1000);
        expect(cutoff.getTime()).toBeGreaterThan(after - 31 * 24 * 60 * 60 * 1000);
    });
});
