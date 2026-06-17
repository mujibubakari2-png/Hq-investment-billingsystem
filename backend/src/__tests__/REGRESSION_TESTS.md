# Tenant Security Regression Tests

## Overview

This test suite verifies the integrity of recent tenant isolation and RBAC security hardening patches applied to the ISP Billing Multi-Tenant system. These tests ensure that:

1. **Tenant Data Isolation** - One tenant cannot access another tenant's data
2. **Permission Enforcement** - Routes enforce RBAC guards correctly
3. **Soft-delete Filtering** - Deleted records are excluded from queries
4. **Route Security** - WireGuard and package routes use only tenant-scoped Prisma queries
5. **Cross-tenant Attack Prevention** - No data leakage even with known IDs

## Test Files

### 1. `tenantSecurityRegressions.test.ts`
**Purpose:** Validates MT-001 (tenant-scoped Prisma client) implementation and core tenant isolation.

**Test Coverage:**
- `findMany()` queries respect tenant boundaries
- `findFirst()` queries return null for cross-tenant lookups
- `update()` operations reject cross-tenant attempts
- `delete()` operations reject cross-tenant attempts
- Multi-tenant model coverage across all TENANT_MODELS
- Super-admin (null tenantId) can access all data
- Soft-delete models automatically exclude deleted records
- Create operations auto-inject tenantId
- JWT payload variations (tenantId vs tenant_id, SUPER_ADMIN bypass)
- Count and aggregate operations respect tenant scope

**Key Assertions:**
```typescript
// Tenant 1 cannot see Tenant 2's data
const db1 = getTenantClient(tenant1Id);
const routers = await db1.router.findMany();
expect(routers.map(r => r.id)).toContain(router1Id);
expect(routers.map(r => r.id)).not.toContain(router2Id);

// Soft-deleted records are excluded
await prisma.client.update({ where: { id }, data: { deletedAt: now } });
const clients = await db1.client.findMany();
expect(clients.map(c => c.id)).not.toContain(id);
```

### 2. `routeSecurityRegressions.test.ts`
**Purpose:** Validates MT-002 (RBAC permission enforcement) and permission matrix correctness.

**Test Coverage:**
- Permission matrix consistency across roles (SUPER_ADMIN, ADMIN, AGENT, VIEWER)
- MT-002 fixes: removed over-permission for AGENT and VIEWER roles
- VIEWER is now strictly read-only (no write/delete permissions)
- AGENT cannot delete clients/vouchers or modify packages/routers
- Permission guard expectations for recent route patches:
  - GET /api/packages requires `packages:read`
  - POST /api/packages requires `packages:write`
  - GET /api/routers/[id]/wireguard requires `routers:read`
  - POST /api/routers/[id]/wireguard requires `routers:write`

**Key Assertions:**
```typescript
// VIEWER is read-only
expect(hasPermission('VIEWER', 'packages:read')).toBe(true);
expect(hasPermission('VIEWER', 'packages:write')).toBe(false);
expect(hasPermission('VIEWER', 'clients:delete')).toBe(false);

// AGENT reduced permissions
expect(hasPermission('AGENT', 'clients:read')).toBe(true);
expect(hasPermission('AGENT', 'clients:write')).toBe(true);
expect(hasPermission('AGENT', 'clients:delete')).toBe(false); // MT-002 fix
```

### 3. `routeIntegration.test.ts`
**Purpose:** Integration-level testing of packages and WireGuard routes with actual Prisma operations.

**Test Coverage:**
- GET /api/packages route behavior and tenant filtering
- POST /api/packages route behavior and tenantId injection
- GET /api/routers/[id]/wireguard route behavior
- POST /api/routers/[id]/wireguard route behavior
- Router validation and ownership checks
- Soft-delete model behavior in route contexts
- Cross-tenant attack scenarios with known IDs
- Permission checks for each route

**Key Scenarios:**
```typescript
// Tenant 1 cannot create package using Tenant 2 router
const db1 = getTenantClient(tenant1Id);
const router = await db1.router.findFirst({ where: { id: router2Id } });
expect(router).toBeNull(); // Router not found in tenant scope

// tenantId spoofing prevention
const pkg = await db1.package.create({ /* router1Id, tenantId: tenant2Id */ });
expect(pkg.tenantId).toBe(tenant1Id); // Auto-injected, cannot override
```

## Security Fixes Validated

### MT-001: Tenant-Scoped Prisma Client
- ✅ All TENANT_MODELS automatically scoped to tenant
- ✅ Soft-delete models filter deleted records
- ✅ Super-admin (null) bypass works correctly
- ✅ Create operations auto-inject tenantId

### MT-002: RBAC Permission Enforcement
- ✅ VIEWER: no write/delete permissions
- ✅ AGENT: reduced permissions (no delete, no router/package write)
- ✅ Routes enforce permission guards
- ✅ Permission matrix is consistent

### Route Hardening
- ✅ WireGuard route uses Prisma only (no raw SQL bypasses)
- ✅ Package route validates router ownership
- ✅ Both routes enforce tenant isolation via getTenantClient
- ✅ canAccessTenant() guards verify ownership

### Soft-Delete Filtering
- ✅ Soft-deleted routers excluded from queries
- ✅ Soft-deleted packages excluded from queries
- ✅ Soft-deleted clients excluded from queries

## Running the Tests

### Prerequisites
- PostgreSQL database running (for integration tests)
- Environment variables configured in `.env` or `jest.setup.ts`

### Run All Security Regression Tests
```bash
npm test -- src/__tests__/tenantSecurity*.test.ts
npm test -- src/__tests__/routeSecurity*.test.ts
npm test -- src/__tests__/routeIntegration.test.ts
```

### Run Specific Test Suite
```bash
# Tenant isolation only
npm test -- src/__tests__/tenantSecurityRegressions.test.ts

# RBAC permissions only
npm test -- src/__tests__/routeSecurityRegressions.test.ts

# Integration tests
npm test -- src/__tests__/routeIntegration.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage src/__tests__/tenantSecurity*.test.ts
```

## Test Data Setup

Each test file creates isolated test data:
- 2 tenants (tenant1, tenant2)
- 1 SaaS plan per test suite
- Routers, packages, clients for each tenant
- Automatic cleanup in `afterAll()` hooks

All data is created fresh for each test run and cleaned up afterward.

## Common Test Patterns

### Verify tenant isolation for queries
```typescript
const db1 = getTenantClient(tenant1Id);
const db2 = getTenantClient(tenant2Id);

const data1 = await db1.model.findMany();
const data2 = await db2.model.findMany();

expect(data1).not.toContain(data2);
```

### Verify cross-tenant rejection
```typescript
const db1 = getTenantClient(tenant1Id);
await expect(
    db1.model.update({ where: { id: tenant2Id }, data: { ... } })
).rejects.toThrow('Not Found or Unauthorized');
```

### Verify permission enforcement
```typescript
expect(hasPermission('VIEWER', 'packages:write')).toBe(false);
expect(hasPermission('ADMIN', 'packages:write')).toBe(true);
```

## Maintenance

### When Adding New Routes
1. Add permission tests to `routeSecurityRegressions.test.ts`
2. Add route behavior tests to `routeIntegration.test.ts`
3. Verify getTenantClient is used for all queries
4. Verify requirePermission guards are in place

### When Adding New Tenant-Scoped Models
1. Ensure model is in Prisma schema with `tenantId` field
2. Add model name to TENANT_MODELS in [tenantPrisma.ts](../lib/tenantPrisma.ts)
3. Add test case to `tenantSecurityRegressions.test.ts` coverage section

### When Modifying RBAC
1. Update PERMISSIONS matrix in [rbac.ts](../lib/rbac.ts)
2. Update permission checks in `routeSecurityRegressions.test.ts`
3. Update route handler guards if permissions changed

## Debugging Failed Tests

### Database Connection Issues
```bash
# Verify test database is running
psql postgresql://user:pass@localhost:5432/testdb

# Check jest.setup.ts for database configuration
cat jest.setup.ts
```

### Type Errors
```bash
# Check Prisma types are up-to-date
npx prisma generate

# Rebuild project
npm run build
```

### Test Isolation Issues
- Each test creates unique data with timestamps
- afterAll() hooks clean up test data
- If cleanup fails, check for foreign key constraints

## Performance Considerations

- Soft-delete filtering adds WHERE clause to every query
- Tenant scoping adds WHERE tenantId = ? to every query
- Extension object created per request (minimal overhead)
- No N+1 queries; use `include` for related data

## Related Documentation

- [Tenant Isolation Architecture](./ARCHITECTURE.md#tenant-isolation)
- [RBAC Implementation](./RBAC.md)
- [Prisma Client Extensions](./TENANT_PRISMA.md)
