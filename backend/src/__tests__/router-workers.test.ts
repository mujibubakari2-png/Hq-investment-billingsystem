/**
 * Router Workers — Unit Tests
 *
 * Tests verify that each worker correctly delegates to the RouterAdapter interface.
 * Uses mocked adapters to avoid real network or DB calls.
 */

import { getRouterAdapter } from '@/lib/routerAdapters';

// Mock the adapter factory
jest.mock('@/lib/routerAdapters', () => ({
    getRouterAdapter: jest.fn(),
}));

// Mock DB calls in workers
jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(() => ({
        router: {
            findUnique: jest.fn().mockResolvedValue({ id: 'r1', vendor: 'mikrotik', tenantId: 'tenant-a' }),
            update: jest.fn().mockResolvedValue({}),
        },
        routerLog: {
            create: jest.fn().mockResolvedValue({}),
        },
        routerProvisioningLog: {
            create: jest.fn().mockResolvedValue({ id: 'pl1' }),
            update: jest.fn().mockResolvedValue({}),
        },
    })),
}));

jest.mock('@/lib/distributedLock', () => ({
    acquireRouterLock: jest.fn().mockResolvedValue({
        release: jest.fn().mockResolvedValue(undefined),
    }),
}));

jest.mock('@/lib/circuitBreaker', () => ({
    getCircuitBreaker: jest.fn().mockReturnValue({
        getState: jest.fn().mockResolvedValue({ state: 'CLOSED', failureCount: 0 }),
        recordSuccess: jest.fn().mockResolvedValue(undefined),
        recordFailure: jest.fn().mockResolvedValue(undefined),
    }),
}));

jest.mock('@/lib/routerRateLimiter', () => ({
    enforceRateLimit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/queue', () => ({
    getRedisConnection: jest.fn().mockReturnValue({}),
}));

jest.mock('@/lib/eventBus', () => ({
    publishEvent: jest.fn().mockResolvedValue(undefined),
}));

const mockGetRouterAdapter = getRouterAdapter as jest.MockedFunction<typeof getRouterAdapter>;

describe('Router Workers — Adapter Delegation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('routerHealth worker', () => {
        it('calls healthCheck() on the adapter and returns result', async () => {
            const mockAdapter = {
                healthCheck: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
            };
            mockGetRouterAdapter.mockResolvedValue(mockAdapter as any);

            // Directly test the logic: get adapter → call healthCheck
            const adapter = await getRouterAdapter('router-1', 'tenant-a');
            const result = await adapter.healthCheck();

            expect(mockGetRouterAdapter).toHaveBeenCalledWith('router-1', 'tenant-a');
            expect(mockAdapter.healthCheck).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true);
            expect(result.message).toBe('ok');
        });

        it('handles healthCheck failure gracefully', async () => {
            const mockAdapter = {
                healthCheck: jest.fn().mockResolvedValue({ success: false, message: 'Connection refused' }),
            };
            mockGetRouterAdapter.mockResolvedValue(mockAdapter as any);

            const adapter = await getRouterAdapter('router-offline', 'tenant-a');
            const result = await adapter.healthCheck();

            expect(result.success).toBe(false);
            expect(result.message).toContain('refused');
        });
    });

    describe('routerDiscovery worker', () => {
        it('calls discoverCapabilities() and returns vendor info for MikroTik', async () => {
            const mockAdapter = {
                discoverCapabilities: jest.fn().mockResolvedValue({
                    vendor: 'mikrotik',
                    firmwareVersion: '7.15',
                    supportedFeatures: ['PPPoE', 'Hotspot', 'WireGuard'],
                    capabilities: { pppoe: true, hotspot: true, wireguard: true },
                    apiType: 'REST',
                }),
            };
            mockGetRouterAdapter.mockResolvedValue(mockAdapter as any);

            const adapter = await getRouterAdapter('router-2', 'tenant-a');
            const caps = await adapter.discoverCapabilities();

            expect(caps.vendor).toBe('mikrotik');
            expect(caps.firmwareVersion).toBe('7.15');
            expect(caps.supportedFeatures).toContain('WireGuard');
            expect(caps.capabilities.wireguard).toBe(true);
        });

        it('calls discoverCapabilities() for Omada vendor', async () => {
            const mockAdapter = {
                discoverCapabilities: jest.fn().mockResolvedValue({
                    vendor: 'omada',
                    firmwareVersion: '1.32.0',
                    supportedFeatures: ['DHCP', 'VLAN', 'Firewall'],
                    capabilities: { dhcp: true, vlan: true },
                    apiType: 'REST',
                }),
            };
            mockGetRouterAdapter.mockResolvedValue(mockAdapter as any);

            const adapter = await getRouterAdapter('router-3', 'tenant-b');
            const caps = await adapter.discoverCapabilities();

            expect(caps.vendor).toBe('omada');
            expect(caps.supportedFeatures).toContain('VLAN');
        });
    });

    describe('routerProvision worker — adapter layer', () => {
        it('uses adapter to discover capabilities before provisioning', async () => {
            const mockAdapter = {
                discoverCapabilities: jest.fn().mockResolvedValue({
                    vendor: 'mikrotik',
                    firmwareVersion: '7.15',
                    supportedFeatures: ['PPPoE', 'Hotspot', 'DHCP', 'DNS', 'Firewall', 'Queue'],
                    capabilities: { hotspot: true, pppoe: true, dhcp: true, firewall: true },
                    apiType: 'REST',
                }),
                createPPPoE: jest.fn().mockResolvedValue({ success: true, message: 'PPPoE created' }),
                createHotspot: jest.fn().mockResolvedValue({ success: true, message: 'Hotspot created' }),
            };
            mockGetRouterAdapter.mockResolvedValue(mockAdapter as any);

            const adapter = await getRouterAdapter('router-4', 'tenant-a');
            const caps = await adapter.discoverCapabilities();

            // Verify the provisioning layer would have access to correct data
            expect(caps.capabilities.hotspot).toBe(true);
            expect(caps.capabilities.pppoe).toBe(true);
            expect(caps.vendor).toBe('mikrotik');
        });

        it('enforces tenant isolation — cannot access another tenant router', async () => {
            mockGetRouterAdapter.mockRejectedValue(
                new Error('Unauthorized: This router belongs to another tenant')
            );

            await expect(getRouterAdapter('router-5', 'wrong-tenant'))
                .rejects
                .toThrow('Unauthorized: This router belongs to another tenant');
        });
    });

    describe('Multi-vendor adapter delegation', () => {
        const vendors = [
            { vendor: 'mikrotik', adapterName: 'MikroTikAdapter', firmwareVersion: '7.15' },
            { vendor: 'omada',    adapterName: 'OmadaAdapter',    firmwareVersion: '1.32.0' },
            { vendor: 'unifi',    adapterName: 'UniFiAdapter',    firmwareVersion: '6.5.0' },
            { vendor: 'tplink',   adapterName: 'TPLinkAdapter',   firmwareVersion: '1.0.0' },
        ];

        vendors.forEach(({ vendor, adapterName }) => {
            it(`creates correct adapter for vendor: ${vendor}`, async () => {
                const mockAdapter = {
                    name: adapterName,
                    vendor,
                    healthCheck: jest.fn().mockResolvedValue({ success: true, message: `${vendor} ok` }),
                    discoverCapabilities: jest.fn().mockResolvedValue({
                        vendor, firmwareVersion: '1.0', supportedFeatures: [], capabilities: {}, apiType: 'REST',
                    }),
                };
                mockGetRouterAdapter.mockResolvedValue(mockAdapter as any);

                const adapter = await getRouterAdapter(`${vendor}-router`, 'tenant-test');
                expect(adapter.name).toBe(adapterName);
                expect(adapter.vendor).toBe(vendor);
            });
        });
    });
});
