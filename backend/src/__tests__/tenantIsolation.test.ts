import { getTenantClient } from "../lib/tenantPrisma";
import prisma from "../lib/prisma";

describe("Tenant Isolation (tenantPrisma)", () => {
    let tenant1Id: string;
    let tenant2Id: string;
    let clientId1: string;
    let clientId2: string;
    let planId: string;

    beforeAll(async () => {
        try {
            // Create a SaasPlan first
            const plan = await prisma.saasPlan.create({
                data: {
                    name: "Test Plan",
                    price: 0,
                    pppoeLimit: 100,
                    hotspotLimit: null,
                    maxRouters: 1
                }
            });
            planId = plan.id;

            // Create 2 tenants
            const t1 = await prisma.tenant.create({
                data: {
                    name: "Tenant 1",
                    email: "t1@test.com",
                    slug: "t1-test",
                    planId: planId
                }
            });
            const t2 = await prisma.tenant.create({
                data: {
                    name: "Tenant 2",
                    email: "t2@test.com",
                    slug: "t2-test",
                    planId: planId
                }
            });
            tenant1Id = t1.id;
            tenant2Id = t2.id;

            // Create a client for each tenant using raw prisma
            const c1 = await prisma.client.create({
                data: {
                    username: "client1_" + Date.now(),
                    fullName: "Client 1",
                    serviceType: "HOTSPOT",
                    status: "ACTIVE",
                    tenantId: tenant1Id,
                }
            });
            clientId1 = c1.id;

            const c2 = await prisma.client.create({
                data: {
                    username: "client2_" + Date.now(),
                    fullName: "Client 2",
                    serviceType: "HOTSPOT",
                    status: "ACTIVE",
                    tenantId: tenant2Id,
                }
            });
            clientId2 = c2.id;
        } catch (e: any) {
            console.error("====== EXPLICIT PRISMA ERROR ======");
            console.error("Code:", e.code);
            console.error("Meta:", e.meta);
            console.error(e.message);
            console.error("===================================");
            throw e;
        }
    });

    afterAll(async () => {
        // Clean up
        await prisma.client.deleteMany({ where: { id: { in: [clientId1, clientId2] } } });
        await prisma.tenant.deleteMany({ where: { id: { in: [tenant1Id, tenant2Id] } } });
        await prisma.saasPlan.delete({ where: { id: planId } });
    });

    it("should only return clients for tenant 1 when using tenant 1 client", async () => {
        const db1 = getTenantClient(tenant1Id);
        const clients = await db1.client.findMany();

        expect(clients.some(c => c.id === clientId1)).toBe(true);
        expect(clients.some(c => c.id === clientId2)).toBe(false);
    });

    it("should only return clients for tenant 2 when using tenant 2 client", async () => {
        const db2 = getTenantClient(tenant2Id);
        const clients = await db2.client.findMany();

        expect(clients.some(c => c.id === clientId1)).toBe(false);
        expect(clients.some(c => c.id === clientId2)).toBe(true);
    });

    it("should not allow updating a client from another tenant", async () => {
        const db1 = getTenantClient(tenant1Id);

        // Attempting to update tenant2's client using tenant1's Prisma client
        await expect(
            db1.client.update({
                where: { id: clientId2 },
                data: { fullName: "Hacked Name" }
            })
        ).rejects.toThrow();
    });

    it("should allow super admin (null tenantId) to see all clients", async () => {
        const superDb = getTenantClient(null);
        const clients = await superDb.client.findMany();

        expect(clients.some(c => c.id === clientId1)).toBe(true);
        expect(clients.some(c => c.id === clientId2)).toBe(true);
    });
});
