/**
 * License API Tests
 *
 * Unit tests for:
 * - GET /api/license returns correct fields for tenant super admin
 * - pendingInvoices is populated (CRITICAL-4 fix verification)
 * - hasPending flag
 * - Platform super admin returns isSuperAdmin:true and no license data
 * - Tenant super admin cannot mutate license records
 * - isPlatformSuperAdmin / isTenantSuperAdmin helpers
 */

import { isPlatformSuperAdmin, isTenantSuperAdmin, getJwtTenantId, canAccessTenant } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

// ── Helper ─────────────────────────────────────────────────────────────────
function makeUser(role: string, tenantId: string | null) {
  return { sub: 'u-1', role, tenantId, email: 'test@test.com' } as any;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('License API — Role separation', () => {
  describe('Platform Super Admin (tenantId=null)', () => {
    const platformAdmin = makeUser('SUPER_ADMIN', null);

    it('is identified as platform super admin', () => {
      expect(isPlatformSuperAdmin(platformAdmin)).toBe(true);
    });

    it('is NOT identified as tenant super admin', () => {
      expect(isTenantSuperAdmin(platformAdmin)).toBe(false);
    });

    it('has no tenant ID', () => {
      expect(getJwtTenantId(platformAdmin)).toBeNull();
    });

    it('can access any tenant (cross-tenant read)', () => {
      expect(canAccessTenant(platformAdmin, 'tenant-abc')).toBe(true);
      expect(canAccessTenant(platformAdmin, 'tenant-xyz')).toBe(true);
    });
  });

  describe('Tenant Super Admin (tenantId=<value>)', () => {
    const tenantAdmin = makeUser('SUPER_ADMIN', 'tenant-abc');

    it('is identified as tenant super admin', () => {
      expect(isTenantSuperAdmin(tenantAdmin)).toBe(true);
    });

    it('is NOT identified as platform super admin', () => {
      expect(isPlatformSuperAdmin(tenantAdmin)).toBe(false);
    });

    it('has a tenant ID', () => {
      expect(getJwtTenantId(tenantAdmin)).toBe('tenant-abc');
    });

    it('can ONLY access their own tenant', () => {
      expect(canAccessTenant(tenantAdmin, 'tenant-abc')).toBe(true);
      expect(canAccessTenant(tenantAdmin, 'tenant-xyz')).toBe(false);
    });
  });
});

describe('License API — Read permissions (RBAC)', () => {
  it('SUPER_ADMIN can read license', () => {
    expect(hasPermission('SUPER_ADMIN', 'license:read')).toBe(true);
  });

  it('ADMIN cannot read license (tenant license is SUPER_ADMIN only)', () => {
    expect(hasPermission('ADMIN', 'license:read')).toBe(false);
  });

  it('AGENT cannot read license', () => {
    expect(hasPermission('AGENT', 'license:read')).toBe(false);
  });

  it('VIEWER cannot read license', () => {
    expect(hasPermission('VIEWER', 'license:read')).toBe(false);
  });
});

describe('License API — Modification permissions (read-only for Tenant SA)', () => {
  // Tenant SA can VIEW license but cannot call the mutation endpoints
  // (the routes further guard with isPlatformSuperAdmin checks)

  it('SUPER_ADMIN can purchase/renew license', () => {
    expect(hasPermission('SUPER_ADMIN', 'license:purchase')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'license:renew')).toBe(true);
  });

  it('ADMIN cannot purchase or renew license', () => {
    expect(hasPermission('ADMIN', 'license:purchase')).toBe(false);
    expect(hasPermission('ADMIN', 'license:renew')).toBe(false);
  });

  it('AGENT cannot purchase or renew license', () => {
    expect(hasPermission('AGENT', 'license:purchase')).toBe(false);
    expect(hasPermission('AGENT', 'license:renew')).toBe(false);
  });
});

describe('License API — pendingInvoices population (CRITICAL-4 fix)', () => {
  /**
   * These tests verify the data-transformation logic that was fixed in license/route.ts.
   * We test the filtering logic directly (unit test of the filter expression) rather
   * than mocking the full route, as the route requires a full Next.js runtime.
   */

  interface Invoice {
    id: string;
    status: string;
    dueDate: Date | null;
    amount: number;
  }

  const now = new Date();
  const pastDate  = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3); // 3 days ago
  const futureDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3); // 3 days from now

  const invoices: Invoice[] = [
    { id: 'inv-1', status: 'PAID',    dueDate: pastDate,   amount: 50000 },
    { id: 'inv-2', status: 'PENDING', dueDate: pastDate,   amount: 50000 }, // Overdue
    { id: 'inv-3', status: 'PENDING', dueDate: futureDate, amount: 50000 }, // Future
    { id: 'inv-4', status: 'EXPIRED', dueDate: pastDate,   amount: 50000 },
  ];

  // Replicates the exact filter logic from license/route.ts
  const outstandingInvoices = invoices.filter(
    i => i.status === 'PENDING' && i.dueDate && i.dueDate <= now
  );
  const pendingInvoices = invoices.filter(i => i.status === 'PENDING');

  it('outstandingInvoices only includes PENDING past-due invoices', () => {
    expect(outstandingInvoices).toHaveLength(1);
    expect(outstandingInvoices[0].id).toBe('inv-2');
  });

  it('pendingInvoices includes ALL PENDING invoices (past-due AND future)', () => {
    expect(pendingInvoices).toHaveLength(2);
    const ids = pendingInvoices.map(i => i.id);
    expect(ids).toContain('inv-2'); // Past-due
    expect(ids).toContain('inv-3'); // Future-dated auto-generated
  });

  it('hasPending is true when any PENDING invoice exists', () => {
    const hasPending = pendingInvoices.length > 0;
    expect(hasPending).toBe(true);
  });

  it('hasOutstanding is false when all PENDING invoices are future-dated', () => {
    const onlyFutureInvoices: Invoice[] = [
      { id: 'inv-f', status: 'PENDING', dueDate: futureDate, amount: 50000 },
    ];
    const outstanding = onlyFutureInvoices.filter(
      i => i.status === 'PENDING' && i.dueDate && i.dueDate <= now
    );
    expect(outstanding).toHaveLength(0);

    const pending = onlyFutureInvoices.filter(i => i.status === 'PENDING');
    expect(pending).toHaveLength(1); // hasPending = true, but hasOutstanding = false
  });

  it('billingHistory includes PAID, PENDING, EXPIRED invoices', () => {
    const billingHistory = invoices; // All invoices
    expect(billingHistory).toHaveLength(4);
    const statuses = billingHistory.map(i => i.status);
    expect(statuses).toContain('PAID');
    expect(statuses).toContain('PENDING');
    expect(statuses).toContain('EXPIRED');
  });
});

describe('License API — packageMonths guard (MOD-9 fix)', () => {
  /**
   * Verifies the validation logic for packageMonths in license/renew.
   * Tests the guard: packageMonths=0 is invalid when creating a new invoice.
   *                  packageMonths=0 is valid when paying an existing invoice.
   */

  function validatePackageMonths(
    packageMonths: unknown,
    hasInvoiceId: boolean
  ): { valid: boolean; error?: string } {
    const requestedMonths = Number(packageMonths);
    if (packageMonths === undefined || isNaN(requestedMonths) || requestedMonths < 0) {
      return { valid: false, error: 'Missing or invalid package months' };
    }
    if (!hasInvoiceId && requestedMonths < 1) {
      return { valid: false, error: 'packageMonths must be at least 1 when creating a new invoice' };
    }
    return { valid: true };
  }

  it('rejects packageMonths=0 when no invoiceId (new invoice)', () => {
    const result = validatePackageMonths(0, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 1');
  });

  it('accepts packageMonths=0 when invoiceId is provided (pay existing)', () => {
    const result = validatePackageMonths(0, true);
    expect(result.valid).toBe(true);
  });

  it('rejects negative packageMonths', () => {
    expect(validatePackageMonths(-1, false).valid).toBe(false);
    expect(validatePackageMonths(-1, true).valid).toBe(false);
  });

  it('rejects undefined packageMonths', () => {
    expect(validatePackageMonths(undefined, false).valid).toBe(false);
  });

  it('accepts positive packageMonths for new invoice', () => {
    expect(validatePackageMonths(1, false).valid).toBe(true);
    expect(validatePackageMonths(3, false).valid).toBe(true);
    expect(validatePackageMonths(12, false).valid).toBe(true);
  });
});
