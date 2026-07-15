import { syncRadiusUser, suspendRadiusUser, deleteRadiusUser } from '@/lib/radius';
import { createHash } from 'crypto';

const mockExecuteRaw = jest.fn();
const mockRadiusUserFindFirst = jest.fn();
const mockRadiusUserCreate = jest.fn();
const mockRadiusUserUpdate = jest.fn();
const mockRadiusUserUpdateMany = jest.fn();
const mockRadiusUserDeleteMany = jest.fn();
const mockRadCheckDeleteMany = jest.fn();
const mockRadReplyDeleteMany = jest.fn();

// Mock the main prisma client to spy on executeRaw
jest.mock('@/lib/prisma', () => ({
    $executeRaw: (...args: any[]) => mockExecuteRaw(...args),
    radReply: { deleteMany: (...args: any[]) => mockRadReplyDeleteMany(...args) },
    radCheck: { deleteMany: (...args: any[]) => mockRadCheckDeleteMany(...args) },
}));

// Mock tenantPrisma getTenantClient
jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(() => ({
        radiusUser: {
            findFirst: mockRadiusUserFindFirst,
            create: mockRadiusUserCreate,
            update: mockRadiusUserUpdate,
            updateMany: mockRadiusUserUpdateMany,
            deleteMany: mockRadiusUserDeleteMany,
        },
        radCheck: {
            deleteMany: mockRadCheckDeleteMany,
        },
        radReply: {
            deleteMany: mockRadReplyDeleteMany,
        }
    }))
}));

describe('RADIUS Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('syncRadiusUser', () => {
        it('should create a new RadiusUser and insert into radcheck and radreply with tenantId', async () => {
            mockRadiusUserFindFirst.mockResolvedValueOnce(null);
            mockRadiusUserCreate.mockResolvedValueOnce({ id: 'ru-1', username: 'test-user', tenantId: 'tenant-1' });

            await syncRadiusUser({
                username: 'test-user',
                password: 'secure',
                tenantId: 'tenant-1',
                rateLimit: '10M/10M',
                profileName: 'Standard',
                simultaneousUse: 2
            });

            // Verify RadiusUser creation
            expect(mockRadiusUserCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    username: 'test-user',
                    password: 'secure',
                    tenantId: 'tenant-1',
                    status: 'Active'
                })
            });

            // Verify raw SQL execution for radcheck MD5-Password
            const md5Hash = createHash('md5').update('secure').digest('hex');
            expect(mockExecuteRaw).toHaveBeenCalledWith(
                expect.arrayContaining([expect.stringContaining('INSERT INTO radcheck')]),
                'test-user', 'MD5-Password', ':=', md5Hash, 'tenant-1'
            );

            // Verify Simultaneous-Use
            expect(mockExecuteRaw).toHaveBeenCalledWith(
                expect.arrayContaining([expect.stringContaining('INSERT INTO radcheck')]),
                'test-user', 'Simultaneous-Use', ':=', '2', 'tenant-1'
            );

            // Verify radreply Mikrotik-Rate-Limit
            expect(mockExecuteRaw).toHaveBeenCalledWith(
                expect.arrayContaining([expect.stringContaining('INSERT INTO radreply')]),
                'test-user', 'Mikrotik-Rate-Limit', '=', '10M/10M', 'tenant-1'
            );

            // Verify radreply Mikrotik-Group
            // RADIUS-001: profileName is sanitized to match the ACTUAL profile name
            // RouterOS has on disk (createProfileFromPackage() uses the same
            // sanitizeMikroTikName()) — 'Standard' -> 'standard'.
            expect(mockExecuteRaw).toHaveBeenCalledWith(
                expect.arrayContaining([expect.stringContaining('INSERT INTO radreply')]),
                'test-user', 'Mikrotik-Group', '=', 'standard', 'tenant-1'
            );
        });

        it('RADIUS-001: sanitizes a profileName with spaces/special chars for Mikrotik-Group', async () => {
            mockRadiusUserFindFirst.mockResolvedValueOnce(null);
            mockRadiusUserCreate.mockResolvedValueOnce({ id: 'ru-2', username: 'test-user-2', tenantId: 'tenant-1' });

            await syncRadiusUser({
                username: 'test-user-2',
                password: 'secure',
                tenantId: 'tenant-1',
                profileName: '10 Mbps / Home Plan!!!',
            });

            expect(mockExecuteRaw).toHaveBeenCalledWith(
                expect.arrayContaining([expect.stringContaining('INSERT INTO radreply')]),
                'test-user-2', 'Mikrotik-Group', '=', '10-mbps-home-plan', 'tenant-1'
            );
        });

        it('should properly format expiration date in radcheck', async () => {
            mockRadiusUserFindFirst.mockResolvedValueOnce({ id: 'ru-1' });
            
            const expiresAt = new Date('2026-10-15T14:30:00Z');
            
            await syncRadiusUser({
                username: 'test-user',
                tenantId: 'tenant-1',
                expiresAt
            });

            // Need to adjust for local timezone formatting since the function formats locally
            // We'll just verify the call was made with Expiration
            const calls = mockExecuteRaw.mock.calls;
            const expirationCall = calls.find(call => call[2] === 'Expiration');
            expect(expirationCall).toBeDefined();
            expect(expirationCall[1]).toBe('test-user');
            expect(expirationCall[3]).toBe(':=');
            expect(expirationCall[5]).toBe('tenant-1');
            
            // Format check - "Oct 15 2026" should be part of it
            expect(expirationCall[4]).toContain('Oct 15 2026');
        });
    });

    describe('suspendRadiusUser', () => {
        it('should mark user inactive and set Expiration in radcheck to the past', async () => {
            await suspendRadiusUser('test-user', 'tenant-1');

            expect(mockRadiusUserUpdateMany).toHaveBeenCalledWith({
                where: { username: 'test-user', tenantId: 'tenant-1' },
                data: { status: 'Inactive' }
            });

            const expirationCall = mockExecuteRaw.mock.calls.find(call => call[2] === 'Expiration');
            expect(expirationCall).toBeDefined();
            
            // Should be a date from the past
            const pastYear = new Date(Date.now() - 86400000).getFullYear();
            expect(expirationCall[4]).toContain(pastYear.toString());
        });
    });

    describe('deleteRadiusUser', () => {
        it('should remove user from radcheck, radreply, and radiusUser', async () => {
            await deleteRadiusUser('test-user', 'tenant-1');

            expect(mockRadCheckDeleteMany).toHaveBeenCalledWith({
                where: { username: 'test-user', tenantId: 'tenant-1' }
            });
            expect(mockRadReplyDeleteMany).toHaveBeenCalledWith({
                where: { username: 'test-user', tenantId: 'tenant-1' }
            });
            expect(mockRadiusUserDeleteMany).toHaveBeenCalledWith({
                where: { username: 'test-user', tenantId: 'tenant-1' }
            });
        });
    });
});
