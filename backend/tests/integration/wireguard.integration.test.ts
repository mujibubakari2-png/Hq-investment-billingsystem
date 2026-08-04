/// <reference types="jest" />
/**
 * WireGuard Integration Test Lab
 * 
 * Verifies WireGuard key management, connectivity checking, and router provisioning engine
 * configuration generation.
 */

// @ts-ignore
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { wireguardManager } from "../../src/lib/wireguard";
import { checkWireGuardReachability } from "../../src/lib/wireguardConnectivity";
import { buildProvisioningPlan } from "../../src/lib/routerProvisioningEngine";
import { getTenantClient } from "../../src/lib/tenantPrisma";
import * as os from 'os';
import * as child_process from 'child_process';

const runE2E = process.env.RUN_E2E_TESTS === "true";

(runE2E ? describe : describe.skip)("WireGuard Integration Tests", () => {
    let routerId = "wg-router-1234";
    let tenantId = "wg-tenant-1234";
    let privateKey: string;
    let publicKey: string;

    beforeAll(async () => {
        const db = getTenantClient(null);

        await db.saasPlan.upsert({
            where: { id: "basic" },
            create: { id: "basic", name: "Basic Plan", price: 0, pppoeLimit: 100 },
            update: {}
        });

        await db.tenant.upsert({
            where: { id: tenantId },
            create: { id: tenantId, name: "Test Tenant WG", slug: "test-tenant-wg", email: "test-wg@example.com", planId: "basic" },
            update: {}
        });

        await db.router.upsert({
            where: { id: routerId },
            create: {
                id: routerId,
                name: "Test WG Router",
                host: "127.0.0.1",
                username: "admin",
                password: "",
                restPort: 8081,
                apiPort: 8729,
                vendor: "mikrotik",
                tenantId: tenantId,
                wgEnabled: true,
                wgPeerPublicKey: "mocked-public-key-1234",
                wgTunnelIp: "10.200.0.10"
            },
            update: {
                wgEnabled: true,
                wgPeerPublicKey: "mocked-public-key-1234",
                wgTunnelIp: "10.200.0.10"
            }
        });
    });

    afterAll(async () => {
        const db = getTenantClient(null);
        await db.router.deleteMany({ where: { id: routerId } });
        await db.tenant.deleteMany({ where: { id: tenantId } });
    });

    test("1. Generate WireGuard Keys (Mock or Live)", async () => {
        try {
            // Note: This relies on the 'wg' command line utility being present in the system.
            // If running on a system without 'wg', this might fail, so we catch and assert on error.
            privateKey = await wireguardManager.generatePrivateKey();
            expect(privateKey).toBeDefined();
            expect(privateKey.length).toBeGreaterThan(0);
            
            publicKey = await wireguardManager.derivePublicKey(privateKey);
            expect(publicKey).toBeDefined();
            expect(publicKey.length).toBeGreaterThan(0);
        } catch (error: any) {
            console.warn("WireGuard 'wg' utility might not be installed. Skipping live key generation check.");
            // If not installed, it should throw an error containing 'ENOENT' or 'command not found'
            expect(error.message).toMatch(/wg|command not found|ENOENT/i);
        }
    });

    test("2. WireGuard Connectivity Checker", async () => {
        // Test connectivity using mock functions to simulate execFile and tcpProbe
        const mockExecRunner = async (cmd: string, args: string[]) => {
            if (cmd === 'ping' && args.includes('10.200.0.10')) {
                return { stdout: '64 bytes from 10.200.0.10: icmp_seq=1 ttl=64 time=0.034 ms' };
            }
            throw new Error("Command failed");
        };

        const mockTcpProbe = async (ip: string, ports: number[]) => {
            return { ok: true, output: `TCP connect succeeded on port 80` };
        };

        const result = await checkWireGuardReachability("10.200.0.10", mockExecRunner, mockTcpProbe);
        expect(result.ok).toBe(true);
        expect(result.reason).toBe("success");
        expect(result.output).toContain("64 bytes from");
    });

    test("3. Router Provisioning Engine - Generates WireGuard Step", async () => {
        const db = getTenantClient(null);
        const router = await db.router.findUnique({ where: { id: routerId } });
        expect(router).toBeDefined();

        const plan = await buildProvisioningPlan(router!, {
            vendor: "mikrotik",
            firmwareVersion: "7.10",
            apiType: "rest",
            supportedFeatures: ["wireguard", "firewall"],
            capabilities: {
                wireguard: true,
                firewall: true
            }
        });

        // Assert that the WireGuard provisioning step was added
        const wgStep = plan.steps.find(step => step.id === "configure-wireguard");
        expect(wgStep).toBeDefined();
        expect(wgStep?.adapterId).toBe("createWireGuardPeer");
        expect(wgStep?.params.allowedAddress).toBe("10.200.0.10/24");
    });
});
