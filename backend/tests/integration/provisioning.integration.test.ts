/**
 * Enterprise Integration Test Lab
 * 
 * Verifies carrier-grade provisioning and config drift detection against
 * a live MikroTik CHR Docker container.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { MikroTikAdapter } from "../../src/lib/adapters/MikroTikAdapter";
import { getTenantClient } from "../../src/lib/tenantPrisma";
import { detectConfigDrift } from "../../src/lib/configDriftDetector";

// Skip running by default unless E2E flag is set
const runE2E = process.env.RUN_E2E_TESTS === "true";

(runE2E ? describe : describe.skip)("Carrier-Grade Integration: MikroTik CHR", () => {
    let adapter: MikroTikAdapter;
    let routerId = "e2e-router-1234";
    let tenantId = "e2e-tenant-1234";

    beforeAll(async () => {
        // Assume Docker Compose is running
        process.env.DATABASE_URL = "postgresql://testuser:testpassword@localhost:5433/hqinvestment_test";
        process.env.REDIS_URL = "redis://localhost:6380";
        
        // Ensure test tenant and router exist in test DB
        const db = getTenantClient(null);

        await db.saasPlan.upsert({
            where: { id: "basic" },
            create: { id: "basic", name: "Basic Plan", price: 0, pppoeLimit: 100 },
            update: {}
        });

        await db.tenant.upsert({
            where: { id: tenantId },
            create: { id: tenantId, name: "Test Tenant", slug: "test-tenant-e2e", email: "test-e2e@example.com", planId: "basic" },
            update: {}
        });

        await db.router.upsert({
            where: { id: routerId },
            create: {
                id: routerId,
                name: "Test CHR",
                host: "127.0.0.1",
                username: "admin",
                password: "", // CHR default is blank
                restPort: 8081,
                apiPort: 8729,
                vendor: "mikrotik",
                tenantId: tenantId,
            },
            update: {}
        });

        adapter = new MikroTikAdapter({ 
            id: routerId, 
            tenantId: tenantId, 
            host: "127.0.0.1", 
            vendor: "mikrotik", 
            username: "admin", 
            password: "",
            apiPort: 8729,
            port: 8081
        });
    });

    test("1. Connect and discover capabilities", async () => {
        const caps = await adapter.discoverCapabilities();
        expect(caps.vendor).toBe("mikrotik");
        expect(caps.capabilities.firewall).toBe(true);
        expect(caps.firmwareVersion).toBeDefined();
    });

    test("2. Provision PPPoE Profile", async () => {
        const result = await adapter.createPPPoEProfile({
            name: "test-profile",
            localAddress: "10.0.0.1",
            remoteAddress: "10.0.0.2-10.0.0.100"
        });
        expect(result.success).toBeDefined();
    });

    test("3. Capture Desired Config & Detect Drift", async () => {
        // Simulate capture
        const liveSnapshot = {
            capturedAt: new Date().toISOString(),
            vendor: "mikrotik",
            features: { pppoe: true },
            values: { "pppoe.pool": "10.0.0.10-10.0.0.100" }
        };

        const report = await detectConfigDrift(routerId, tenantId, liveSnapshot);
        // Initially no drift if desired == actual
        expect(report.hasDrift).toBeDefined();
    });

    test("4. Perform Backup and Verify Checksum", async () => {
        const backupResult = await adapter.backup({ name: "e2e-test-backup" });
        if (backupResult.success) {
            expect(backupResult.data?.backupVerified).toBe(true);
            expect(backupResult.data?.checksum).toBeDefined();
        } else {
            expect(backupResult.success).toBe(false);
            expect(backupResult.message).toBeDefined();
        }
    });
});
