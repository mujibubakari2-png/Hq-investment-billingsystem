/**
 * RBAC unit tests â€” hasPermission, hasRole, PERMISSIONS matrix
 * 
 * These are pure logic functions with no I/O dependencies â€” no mocking needed.
 * Tests confirm the MT-002 fix (VIEWER/AGENT over-permission removal) is correct.
 */

import { hasPermission, hasRole, PERMISSIONS, type Permission } from '../lib/rbac';

// â”€â”€ Minimal JwtPayload shape needed by hasRole â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeUser(role: string) {
    return { id: 'u1', userId: 'u1', username: 'test', email: 'test@hq.test', role, tenantId: 't1' };
}


describe('hasPermission', () => {
    // â”€â”€ SUPER_ADMIN full access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    it('SUPER_ADMIN has license:read', () => {
        expect(hasPermission('SUPER_ADMIN', 'license:read')).toBe(true);
    });

    it('SUPER_ADMIN has clients:delete', () => {
        expect(hasPermission('SUPER_ADMIN', 'clients:delete')).toBe(true);
    });

    it('SUPER_ADMIN has payment-channels:write', () => {
        expect(hasPermission('SUPER_ADMIN', 'payment-channels:write')).toBe(true);
    });

    // â”€â”€ ADMIN access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    it('ADMIN can read clients', () => {
        expect(hasPermission('ADMIN', 'clients:read')).toBe(true);
    });

    it('ADMIN can write clients', () => {
        expect(hasPermission('ADMIN', 'clients:write')).toBe(true);
    });

    it('ADMIN can delete clients', () => {
        expect(hasPermission('ADMIN', 'clients:delete')).toBe(true);
    });

    it('ADMIN cannot access license:read (SUPER_ADMIN only)', () => {
        expect(hasPermission('ADMIN', 'license:read')).toBe(false);
    });

    it('ADMIN cannot write to payment-channels (SUPER_ADMIN only)', () => {
        expect(hasPermission('ADMIN', 'payment-channels:write')).toBe(false);
    });

    // â”€â”€ AGENT access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    it('AGENT can read clients', () => {
        expect(hasPermission('AGENT', 'clients:read')).toBe(true);
    });

    it('AGENT can write clients (create subscribers)', () => {
        expect(hasPermission('AGENT', 'clients:write')).toBe(true);
    });

    it('AGENT cannot delete clients (MT-002 fix)', () => {
        expect(hasPermission('AGENT', 'clients:delete')).toBe(false);
    });

    it('AGENT can create vouchers', () => {
        expect(hasPermission('AGENT', 'vouchers:create')).toBe(true);
    });

    it('AGENT cannot delete vouchers (MT-002 fix)', () => {
        expect(hasPermission('AGENT', 'vouchers:delete')).toBe(false);
    });

    it('AGENT can read dashboard', () => {
        expect(hasPermission('AGENT', 'dashboard:read')).toBe(true);
    });

    // â”€â”€ VIEWER access (read-only enforcement â€” MT-002 fix) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    it('VIEWER can read clients', () => {
        expect(hasPermission('VIEWER', 'clients:read')).toBe(true);
    });

    it('VIEWER cannot write clients (MT-002 fix â€” was incorrectly allowed)', () => {
        expect(hasPermission('VIEWER', 'clients:write')).toBe(false);
    });

    it('VIEWER cannot delete clients (MT-002 fix)', () => {
        expect(hasPermission('VIEWER', 'clients:delete')).toBe(false);
    });

    it('VIEWER cannot create vouchers (MT-002 fix)', () => {
        expect(hasPermission('VIEWER', 'vouchers:create')).toBe(false);
    });

    it('VIEWER can read vouchers', () => {
        expect(hasPermission('VIEWER', 'vouchers:read')).toBe(true);
    });

    it('VIEWER can read subscriptions', () => {
        expect(hasPermission('VIEWER', 'subscriptions:read')).toBe(true);
    });

    it('VIEWER cannot write subscriptions', () => {
        expect(hasPermission('VIEWER', 'subscriptions:write')).toBe(false);
    });

    it('VIEWER cannot delete subscriptions', () => {
        expect(hasPermission('VIEWER', 'subscriptions:delete')).toBe(false);
    });

    it('VIEWER cannot access audit-logs:read (SUPER_ADMIN only)', () => {
        expect(hasPermission('VIEWER', 'audit-logs:read')).toBe(false);
    });

    // â”€â”€ Unknown role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    it('Unknown role returns false for all permissions', () => {
        const permissions = Object.keys(PERMISSIONS) as Permission[];
        permissions.forEach(perm => {
            expect(hasPermission('HACKER', perm)).toBe(false);
        });
    });
});

describe('hasRole', () => {
    it('returns true when user role matches', () => {
        expect(hasRole(makeUser('SUPER_ADMIN'), 'SUPER_ADMIN')).toBe(true);
    });

    it('returns true when user role is in the allowed list', () => {
        expect(hasRole(makeUser('ADMIN'), 'SUPER_ADMIN', 'ADMIN')).toBe(true);
    });

    it('returns false when user role is not in the allowed list', () => {
        expect(hasRole(makeUser('VIEWER'), 'SUPER_ADMIN', 'ADMIN')).toBe(false);
    });

    it('returns false for AGENT when only SUPER_ADMIN listed', () => {
        expect(hasRole(makeUser('AGENT'), 'SUPER_ADMIN')).toBe(false);
    });
});

describe('PERMISSIONS matrix structure', () => {
    it('every permission value is a non-empty array', () => {
        (Object.values(PERMISSIONS) as unknown as string[][]).forEach(roles => {
            expect(Array.isArray(roles)).toBe(true);
            expect(roles.length).toBeGreaterThan(0);
        });
    });

    it('SUPER_ADMIN appears in every permission', () => {
        (Object.values(PERMISSIONS) as unknown as string[][]).forEach(roles => {
            expect(roles).toContain('SUPER_ADMIN');
        });
    });

    it('VIEWER never has write or delete permissions', () => {
        const writeOrDelete = (Object.keys(PERMISSIONS) as Permission[]).filter(
            p => p.endsWith(':write') || p.endsWith(':delete') || p.endsWith(':create') || p.endsWith(':purchase') || p.endsWith(':renew')
        );
        writeOrDelete.forEach(perm => {
            expect(hasPermission('VIEWER', perm)).toBe(false);
        });
    });
});
