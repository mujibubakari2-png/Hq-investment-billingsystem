import { MikroTikService, getMikroTikService } from '@/lib/mikrotik';
import { env } from '@/lib/env';
import { getTenantClient } from '@/lib/tenantPrisma';

// Mock env
jest.mock('@/lib/env', () => ({
    env: {
        MIKROTIK_TIMEOUT_MS: 1000,
        MIKROTIK_USE_HTTPS: true,
        MIKROTIK_INSECURE: false,
    }
}));

// Mock tenantPrisma
const mockRouterLogCreate = jest.fn();
const mockRouterUpdate = jest.fn();

jest.mock('@/lib/tenantPrisma', () => ({
    getTenantClient: jest.fn(),
}));

describe('MikroTikService', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
        originalFetch = global.fetch;
        global.fetch = jest.fn();

        (getTenantClient as jest.Mock).mockImplementation((tenantId?: string | null) => ({
            routerLog: { create: mockRouterLogCreate },
            router: {
                update: mockRouterUpdate,
                findUnique: jest.fn().mockResolvedValue(null),
            },
        }));
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.MIKROTIK_ALLOW_HTTP_FALLBACK;
    });

    it('should fall back to HTTP if HTTPS fails and MIKROTIK_ALLOW_HTTP_FALLBACK is true', async () => {
        process.env.MIKROTIK_ALLOW_HTTP_FALLBACK = 'true';

        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 8728, // API port, should map to 443 with HTTPS
            username: 'admin',
            password: 'password'
        }, 'router-123', 'tenant-1');

        // First call fails (HTTPS), second call succeeds (HTTP) for /system/identity
        // Third call succeeds (HTTPS - though in reality it might fail too, we just want to mock the success for /system/resource)
        (global.fetch as jest.Mock)
            .mockRejectedValueOnce(new Error('Connection refused'))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify([{ name: 'mikrotik-test' }])
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify([{ version: '7.12' }])
            });

        const result = await service.testConnection();
        expect(global.fetch).toHaveBeenCalledTimes(3);
        
        // Ensure the second call was HTTP (for system/identity)
        expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('http://10.0.0.1:443/rest/system/identity');
        expect(result.success).toBe(true);
    });

    it('should throw an error if HTTPS fails and MIKROTIK_ALLOW_HTTP_FALLBACK is false', async () => {
        process.env.MIKROTIK_ALLOW_HTTP_FALLBACK = 'false';

        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 8728,
            username: 'admin',
            password: 'password'
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

        const result = await service.testConnection();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(false);
    });

    it('should log correctly with tenantId on successful action', async () => {
        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 80,
            username: 'admin',
            password: 'password',
            restPort: 80
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify([{ ".id": "*1", name: "test-user" }])
        });

        await service.listPPPoEUsers();

        // There's no log for list but let's test a create action
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({ ".id": "*2" })
        });

        await service.createPPPoEUser({
            name: 'new-user',
            password: 'secure',
            service: 'pppoe',
            profile: 'default',
            disabled: false
        });

        expect(mockRouterLogCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                routerId: 'router-123',
                action: 'create_pppoe_user',
                tenantId: 'tenant-1',
                username: 'new-user'
            })
        });
    });

    it('should format uptime correctly in activateService', async () => {
        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 80,
            username: 'admin',
            password: 'password',
            restPort: 80
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock)
            // findHotspotUserByName returns null
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify([])
            })
            // createHotspotUser returns success
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ ".id": "*3" })
            });

        const futureDate = new Date(Date.now() + (86400 * 1000) + (3600 * 1000) + (120 * 1000)); // 1 day, 1 hour, 2 minutes
        await service.activateService('user', 'pass', 'default-profile', 'hotspot', futureDate);

        // Verify the create API call payload contains formatted limit-uptime
        const createCall = (global.fetch as jest.Mock).mock.calls[1];
        const body = JSON.parse(createCall[1].body);

        // 1d01:02:00
        expect(body['limit-uptime']).toMatch(/^1d01:0[12]:\d\d$/); // Allow small variance due to execution time
    });

    it('should allow a WireGuard tunnel IP when the router is already configured for WireGuard', async () => {
        const unscopedFindUnique = jest.fn().mockResolvedValue({
            id: 'router-789',
            tenantId: 'tenant-1',
            host: '10.0.0.200',
            wgTunnelIp: '10.0.0.200',
            wgEnabled: true,
            port: 8728,
            username: 'admin',
            password: 'password',
        });

        (getTenantClient as jest.Mock).mockImplementation((tenantId?: string | null) => ({
            routerLog: { create: mockRouterLogCreate },
            router: {
                update: mockRouterUpdate,
                findUnique: tenantId === null ? unscopedFindUnique : jest.fn().mockResolvedValue(null),
            },
        }));

        const service = await getMikroTikService('router-789', 'tenant-1');

        expect(service).toBeInstanceOf(MikroTikService);
    });

    it('should deny cross-tenant router access with an explicit tenant mismatch error', async () => {
        const scopedFindUnique = jest.fn().mockResolvedValue(null);
        const unscopedFindUnique = jest.fn().mockResolvedValue({
            id: 'router-456',
            tenantId: 'tenant-2',
            host: '10.0.0.2',
            port: 8728,
            username: 'admin',
            password: 'password',
        });

        (getTenantClient as jest.Mock).mockImplementation((tenantId?: string | null) => ({
            routerLog: { create: mockRouterLogCreate },
            router: {
                update: mockRouterUpdate,
                findUnique: tenantId === null ? unscopedFindUnique : scopedFindUnique,
            },
        }));

        await expect(getMikroTikService('router-456', 'tenant-1')).rejects.toThrow(
            'Unauthorized: This router belongs to another tenant'
        );
    });
});
