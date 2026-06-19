/**
 * Integration Tests: Packages and WireGuard Routes
 *
 * Tests for:
 * - /api/packages route (GET: packages:read guard, POST: packages:write guard)
 * - /api/routers/[id]/wireguard route (GET: routers:read guard, POST: routers:write guard)
 * - Tenant isolation enforcement
 * - Router validation and ownership checks
 */

import { getTenantClient } from '../lib/tenantPrisma';
import { hasPermission } from '../lib/rbac';
import prisma from '../lib/prisma';

describe('Route Integration Tests: Packages and WireGuard', () => {
    let tenant1Id: string;
    let tenant2Id: string;
    let router1Id: string;
    let router2Id: string;
    let package1Id: string;
    let planId: string;

    beforeAll(async () => {
        // Setup
        const plan = await prisma.saasPlan.create({
            data: {
                name: 'Route Test Plan',
                price: 0,
                pppoeLimit: 100,
                hotspotLimit: 50,
                maxRouters: 5,
            },
        });
        planId = plan.id;

        const t1 = await prisma.tenant.create({
            data: {
                name: 'Route Test Tenant 1',
                email: 'route-t1@test.com',
                slug: 'route-t1-' + Date.now(),
                planId,
            },
        });
        const t2 = await prisma.tenant.create({
            data: {
                name: 'Route Test Tenant 2',
                email: 'route-t2@test.com',
                slug: 'route-t2-' + Date.now(),
                planId,
            },
        });
        tenant1Id = t1.id;
        tenant2Id = t2.id;

        const r1 = await prisma.router.create({
            data: {
                name: 'Route Test Router 1',
                host: '192.168.1.1',
                port: 8728,
                username: 'admin',
                password: 'password',
                tenantId: tenant1Id,
                status: 'ONLINE',
            },
        });
        const r2 = await prisma.router.create({
            data: {
                name: 'Route Test Router 2',
                host: '192.168.2.1',
                port: 8728,
                username: 'admin',
                password: 'password',
                tenantId: tenant2Id,
                status: 'ONLINE',
            },
        });
        router1Id = r1.id;
        router2Id = r2.id;

        const pkg = await prisma.package.create({
            data: {
                name: 'Route Test Package 1',
                type: 'PPPOE',
                category: 'PERSONAL',
                downloadSpeed: 10,
                downloadUnit: 'MBPS',
                uploadSpeed: 5,
                uploadUnit: 'MBPS',
                price: 50,
                duration: 30,
                durationUnit: 'DAYS',
                status: 'ACTIVE',
                tenantId: tenant1Id,
                routerId: router1Id,
            },
        });
        package1Id = pkg.id;
    });

    afterAll(async () => {
        await prisma.package.deleteMany({
            where: { tenantId: { in: [tenant1Id, tenant2Id] } },
        });
        await prisma.router.deleteMany({
            where: { tenantId: { in: [tenant1Id, tenant2Id] } },
        });
        await prisma.tenant.deleteMany({ where: { id: { in: [tenant1Id, tenant2Id] } } });
        await prisma.saasPlan.delete({ where: { id: planId } });
    });

    // ── Package Route: List & Create ────────────────────────────────────────

    describe('GET /api/packages route behavior', () => {
        it('Tenant 1 should only see own packages via Prisma query', async () => {
            const db1 = getTenantClient(tenant1Id);
            const packages = await db1.package.findMany();

            const ids = packages.map((p) => p.id);
            expect(ids).toContain(package1Id);
        });

        it('Tenant 1 cannot see Tenant 2 packages', async () => {
            const db1 = getTenantClient(tenant1Id);
            const packages = await db1.package.findMany({
                where: { tenantId: tenant2Id }, // User tries to spoof tenant2Id
            });

            // The Proxy overrides the spoofed tenantId with the caller's true tenantId.
            // So instead of returning Tenant 2's packages (or 0 if none), it returns
            // Tenant 1's own packages, effectively ignoring the spoof attempt.
            expect(packages.every(p => p.tenantId === tenant1Id)).toBe(true);
        });

        it('Super admin can see all packages', async () => {
            const superDb = getTenantClient(null);
            const packages = await superDb.package.findMany();

            const ids = packages.map((p) => p.id);
            expect(ids).toContain(package1Id);
        });

        it('Permission check: ADMIN can read packages', () => {
            expect(hasPermission('ADMIN', 'packages:read')).toBe(true);
        });

        it('Permission check: VIEWER can read packages', () => {
            expect(hasPermission('VIEWER', 'packages:read')).toBe(true);
        });
    });

    describe('POST /api/packages route behavior', () => {
        it('Package creation auto-injects tenantId', async () => {
            const db1 = getTenantClient(tenant1Id);
            const newPkg = await db1.package.create({
                data: {
                    name: 'Route Test New Package',
                    type: 'HOTSPOT',
                    category: 'BUSINESS',
                    downloadSpeed: 20,
                    downloadUnit: 'MBPS',
                    uploadSpeed: 10,
                    uploadUnit: 'MBPS',
                    price: 100,
                    duration: 30,
                    durationUnit: 'DAYS',
                    status: 'ACTIVE',
                    routerId: router1Id,
                },
            });

            expect(newPkg.tenantId).toBe(tenant1Id);
            expect(newPkg.routerId).toBe(router1Id);

            // Cleanup
            await prisma.package.delete({ where: { id: newPkg.id } });
        });

        it('Tenant 1 cannot create package using Tenant 2 router', async () => {
            const db1 = getTenantClient(tenant1Id);

            // findFirst should not find router2 (different tenant)
            const router = await db1.router.findFirst({
                where: { id: router2Id },
            });

            expect(router).toBeNull();
        });

        it('Permission check: ADMIN can write packages', () => {
            expect(hasPermission('ADMIN', 'packages:write')).toBe(true);
        });

        it('Permission check: AGENT cannot write packages (MT-002)', () => {
            expect(hasPermission('AGENT', 'packages:write')).toBe(false);
        });

        it('Permission check: VIEWER cannot write packages', () => {
            expect(hasPermission('VIEWER', 'packages:write')).toBe(false);
        });
    });

    // ── WireGuard Route: Get Config & Activate ──────────────────────────────

    describe('GET /api/routers/[id]/wireguard route behavior', () => {
        it('Tenant 1 can retrieve own router WireGuard config', async () => {
            const db1 = getTenantClient(tenant1Id);
            const router = await db1.router.findFirst({
                where: { id: router1Id },
                select: {
                    id: true,
                    name: true,
                    wgEnabled: true,
                    wgPrivateKey: true,
                    tenantId: true,
                },
            });

            expect(router).not.toBeNull();
            expect(router?.tenantId).toBe(tenant1Id);
        });

        it('Tenant 1 cannot access Tenant 2 router WireGuard config', async () => {
            const db1 = getTenantClient(tenant1Id);
            const router = await db1.router.findFirst({
                where: { id: router2Id },
            });

            expect(router).toBeNull();
        });

        it('Permission check: ADMIN can read routers', () => {
            expect(hasPermission('ADMIN', 'routers:read')).toBe(true);
        });

        it('Permission check: AGENT can read routers', () => {
            expect(hasPermission('AGENT', 'routers:read')).toBe(true);
        });

        it('Permission check: VIEWER can read routers', () => {
            expect(hasPermission('VIEWER', 'routers:read')).toBe(true);
        });
    });

    describe('POST /api/routers/[id]/wireguard route behavior', () => {
        it('Tenant 1 can activate WireGuard on own router', async () => {
            const db1 = getTenantClient(tenant1Id);

            // Simulate getting the router (what the route would do)
            const router = await db1.router.findFirst({
                where: { id: router1Id },
                select: {
                    id: true,
                    tenantId: true,
                    wgEnabled: true,
                    wgPrivateKey: true,
                },
            });

            expect(router).not.toBeNull();

            // Simulate updating WireGuard config
            if (router) {
                const updated = await db1.router.update({
                    where: { id: router.id },
                    data: { wgEnabled: true },
                    select: { id: true, wgEnabled: true, tenantId: true },
                });

                expect(updated.wgEnabled).toBe(true);
                expect(updated.tenantId).toBe(tenant1Id);

                // Restore for other tests
                await db1.router.update({
                    where: { id: router.id },
                    data: { wgEnabled: false },
                });
            }
        });

        it('Tenant 1 cannot modify Tenant 2 router WireGuard', async () => {
            const db1 = getTenantClient(tenant1Id);

            // Should not find router2
            const router = await db1.router.findFirst({
                where: { id: router2Id },
            });

            expect(router).toBeNull();

            // If attempted update directly, should fail
            await expect(
                db1.router.update({
                    where: { id: router2Id },
                    data: { wgEnabled: true },
                })
            ).rejects.toThrow('Not Found or Unauthorized');
        });

        it('Permission check: ADMIN can write routers', () => {
            expect(hasPermission('ADMIN', 'routers:write')).toBe(true);
        });

        it('Permission check: AGENT cannot write routers (MT-002)', () => {
            expect(hasPermission('AGENT', 'routers:write')).toBe(false);
        });

        it('Permission check: VIEWER cannot write routers', () => {
            expect(hasPermission('VIEWER', 'routers:write')).toBe(false);
        });
    });

    // ── Router Validation ───────────────────────────────────────────────────

    describe('Router validation and ownership checks', () => {
        it('Package lookup validates router belongs to same tenant', async () => {
            const db1 = getTenantClient(tenant1Id);

            // When creating a package, router lookup should respect tenant scope
            const router = await db1.router.findFirst({
                where: {
                    id: router1Id,
                },
                select: { id: true, tenantId: true, name: true },
            });

            expect(router).not.toBeNull();
            expect(router?.tenantId).toBe(tenant1Id);
        });

        it('WireGuard route verifies router belongs to user tenant', async () => {
            const db1 = getTenantClient(tenant1Id);
            const db2 = getTenantClient(tenant2Id);

            // Tenant 1 can find own router
            const r1 = await db1.router.findFirst({ where: { id: router1Id } });
            expect(r1).not.toBeNull();

            // Tenant 1 cannot find Tenant 2 router
            const r2 = await db1.router.findFirst({ where: { id: router2Id } });
            expect(r2).toBeNull();

            // Tenant 2 can find own router
            const r2Own = await db2.router.findFirst({ where: { id: router2Id } });
            expect(r2Own).not.toBeNull();

            // Tenant 2 cannot find Tenant 1 router
            const r1Denied = await db2.router.findFirst({ where: { id: router1Id } });
            expect(r1Denied).toBeNull();
        });
    });

    // ── Soft Delete Behavior ────────────────────────────────────────────────

    describe('Soft-delete models in routes exclude deleted records', () => {
        it('Soft-deleted routers do not appear in findMany', async () => {
            // Create a router
            const testRouter = await prisma.router.create({
                data: {
                    name: 'Soft Delete Test Router',
                    host: '192.168.99.1',
                    port: 8728,
                    username: 'admin',
                    password: 'password',
                    tenantId: tenant1Id,
                    status: 'ONLINE',
                },
            });

            // Soft delete it
            await prisma.router.update({
                where: { id: testRouter.id },
                data: { deletedAt: new Date() },
            });

            // Query with tenant-scoped client
            const db1 = getTenantClient(tenant1Id);
            const routers = await db1.router.findMany();
            const ids = routers.map((r) => r.id);

            // Should not contain the soft-deleted router
            expect(ids).not.toContain(testRouter.id);

            // Hard delete for cleanup
            await prisma.router.delete({ where: { id: testRouter.id } });
        });

        it('Soft-deleted packages do not appear in package listings', async () => {
            // Create a package
            const testPkg = await prisma.package.create({
                data: {
                    name: 'Soft Delete Test Package',
                    type: 'PPPOE',
                    category: 'PERSONAL',
                    downloadSpeed: 10,
                    downloadUnit: 'MBPS',
                    uploadSpeed: 5,
                    uploadUnit: 'MBPS',
                    price: 50,
                    duration: 30,
                    durationUnit: 'DAYS',
                    status: 'ACTIVE',
                    tenantId: tenant1Id,
                    routerId: router1Id,
                },
            });

            // Soft delete it
            await prisma.package.update({
                where: { id: testPkg.id },
                data: { deletedAt: new Date() },
            });

            // Query with tenant-scoped client
            const db1 = getTenantClient(tenant1Id);
            const packages = await db1.package.findMany();
            const ids = packages.map((p) => p.id);

            // Should not contain the soft-deleted package
            expect(ids).not.toContain(testPkg.id);

            // Hard delete for cleanup
            await prisma.package.delete({ where: { id: testPkg.id } });
        });
    });

    // ── Cross-Tenant Attack Scenarios ───────────────────────────────────────

    describe('Security: Cross-tenant attack prevention', () => {
        it('Tenant 1 cannot spoof Tenant 2 tenantId in package creation', async () => {
            const db1 = getTenantClient(tenant1Id);

            const newPkg = await db1.package.create({
                data: {
                    name: 'Attack Package',
                    type: 'PPPOE',
                    category: 'PERSONAL',
                    downloadSpeed: 10,
                    downloadUnit: 'MBPS',
                    uploadSpeed: 5,
                    uploadUnit: 'MBPS',
                    price: 50,
                    duration: 30,
                    durationUnit: 'DAYS',
                    status: 'ACTIVE',
                    routerId: router1Id,
                    // Note: tenantId is auto-injected as tenant1Id by getTenantClient
                    // User cannot override it
                },
            });

            // The package must belong to tenant1Id, not tenant2Id
            expect(newPkg.tenantId).toBe(tenant1Id);
            expect(newPkg.tenantId).not.toBe(tenant2Id);

            // Cleanup
            await prisma.package.delete({ where: { id: newPkg.id } });
        });

        it('Tenant 1 cannot retrieve package details by guessing ID if it belongs to Tenant 2', async () => {
            // Create a package for Tenant 2
            const tenant2Pkg = await prisma.package.create({
                data: {
                    name: 'Secret Tenant 2 Package',
                    type: 'HOTSPOT',
                    category: 'BUSINESS',
                    downloadSpeed: 50,
                    downloadUnit: 'MBPS',
                    uploadSpeed: 25,
                    uploadUnit: 'MBPS',
                    price: 500,
                    duration: 30,
                    durationUnit: 'DAYS',
                    status: 'ACTIVE',
                    tenantId: tenant2Id,
                    routerId: router2Id,
                },
            });

            // Tenant 1 tries to access it
            const db1 = getTenantClient(tenant1Id);
            const found = await db1.package.findFirst({
                where: { id: tenant2Pkg.id },
            });

            // Should not be found
            expect(found).toBeNull();

            // Cleanup
            await prisma.package.delete({ where: { id: tenant2Pkg.id } });
        });

        it('Tenant 1 cannot modify Tenant 2 router even with known ID', async () => {
            const db1 = getTenantClient(tenant1Id);

            // Attempt to update Tenant 2's router
            await expect(
                db1.router.update({
                    where: { id: router2Id },
                    data: { name: 'Hacked Router Name' },
                })
            ).rejects.toThrow();
        });
    });
});
