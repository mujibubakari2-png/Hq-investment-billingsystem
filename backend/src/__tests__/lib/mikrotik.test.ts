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
            host: 'router.example.com',
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
        expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('http://router.example.com/rest/system/identity');
        expect(result.success).toBe(true);
    });

    it('should throw an error if HTTPS fails and MIKROTIK_ALLOW_HTTP_FALLBACK is false', async () => {
        process.env.MIKROTIK_ALLOW_HTTP_FALLBACK = 'false';

        const service = new MikroTikService({
            host: 'router.example.com',
            port: 8728,
            username: 'admin',
            password: 'password'
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

        const result = await service.testConnection();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(false);
    });

    it('should retry over HTTP on port 80 when HTTPS times out for a RouterOS management endpoint', async () => {
        const service = new MikroTikService({
            host: '10.0.0.200',
            port: 8728,
            username: 'admin',
            password: 'password'
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock)
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify([{ name: 'mikrotik-test' }])
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify([{ version: '7.12' }])
            });

        const result = await service.testConnection();

        expect(result.success).toBe(true);
        expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('https://10.0.0.200:443/rest/system/identity');
        expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('http://10.0.0.200/rest/system/identity');
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

    it('RADIUS-001: activateService makes NO MikroTik API calls (RADIUS is sole source of truth)', async () => {
        // Regression guard for the dual-write bug (audit report point #2): this
        // method used to create/enable a local /ip/hotspot/user or /ppp/secret,
        // which RouterOS would silently prefer over RADIUS. It must now be a
        // pure log write — zero fetch() calls, zero local user side effects.
        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 80,
            username: 'admin',
            password: 'password',
            restPort: 80
        }, 'router-123', 'tenant-1');

        const futureDate = new Date(Date.now() + 86400 * 1000);
        await service.activateService('user', 'pass', 'default-profile', 'hotspot', futureDate);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockRouterLogCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                routerId: 'router-123',
                action: 'activate_service',
                username: 'user',
                status: 'success',
            }),
        });
    });

    it('RADIUS-001: suspendService only kicks the active session, never disables a local secret', async () => {
        // Regression guard: suspendService() used to call findHotspotUserByName +
        // disableHotspotUser (a local secret write). It must now ONLY read the
        // active-sessions list and, if the user is connected, DELETE that one
        // session — no /ip/hotspot/user or /ppp/secret calls at all.
        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 80,
            username: 'admin',
            password: 'password',
            restPort: 80
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock)
            // listHotspotActiveSessions()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify([{ '.id': '*A1', user: 'user', address: '10.0.0.55' }]),
            })
            // disconnectHotspotSession() DELETE
            .mockResolvedValueOnce({ ok: true, text: async () => '{}' });

        await service.suspendService('user', 'hotspot');

        expect(global.fetch).toHaveBeenCalledTimes(2);
        const sessionListUrl = (global.fetch as jest.Mock).mock.calls[0][0];
        const disconnectCall = (global.fetch as jest.Mock).mock.calls[1];
        expect(sessionListUrl).toContain('/ip/hotspot/active');
        expect(disconnectCall[0]).toContain('/ip/hotspot/active/*A1');
        expect(disconnectCall[1].method).toBe('DELETE');

        // Must never touch the local hotspot user table
        const allUrls = (global.fetch as jest.Mock).mock.calls.map((c: any[]) => c[0]);
        expect(allUrls.some((u: string) => u.includes('/ip/hotspot/user'))).toBe(false);
    });

    it('RADIUS-001: suspendService with no active session still succeeds (no reconnect possible, blocked by RADIUS)', async () => {
        const service = new MikroTikService({
            host: '10.0.0.1',
            port: 80,
            username: 'admin',
            password: 'password',
            restPort: 80
        }, 'router-123', 'tenant-1');

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify([]), // no matching active session
        });

        await expect(service.suspendService('offline-user', 'pppoe')).resolves.not.toThrow();
        expect(global.fetch).toHaveBeenCalledTimes(1); // only the session list lookup, no DELETE
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

    // ── BUG FIX REGRESSION TESTS ─────────────────────────────────────────────

    it('[BUG-FIX] 401 response should throw clear auth error, NOT "Failed to connect"', async () => {
        // When RouterOS returns HTTP 401, the old code wrapped it with "Failed to connect to X"
        // making it look like a network problem. Now it should throw a clear authentication error.
        const service = new MikroTikService({
            host: '10.0.0.200',
            port: 8728,
            username: 'admin',
            password: 'wrong-password',
            restPort: 80,
        }, 'router-401', 'tenant-1');

        // testConnection calls apiRequest twice (identity + resource).
        // Both should fail with 401 — we only need to mock one since testConnection
        // catches errors and returns { success: false, message }.
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => JSON.stringify({ error: 401, message: 'Unauthorized' }),
        });

        const result = await service.testConnection();

        // Must fail with auth-specific message
        expect(result.success).toBe(false);
        expect(result.message).toContain('Authentication failed (401)');
        // Must include the host and username for actionable debugging
        expect(result.message).toContain('10.0.0.200');
        expect(result.message).toContain('admin');
        // Must NOT say "Failed to connect" — that's misleading for a credential error
        expect(result.message).not.toContain('Failed to connect');
    });

    it('[BUG-FIX] HTTP 401 error should NOT be wrapped with "Failed to connect" prefix', async () => {
        // apiRequest must re-throw RouterOS HTTP errors without the misleading network-error prefix
        const service = new MikroTikService({
            host: '10.0.0.200',
            port: 80,
            username: 'admin',
            password: '',
            restPort: 80,
        }, 'router-401b', 'tenant-1');

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => '{"error":401,"message":"Unauthorized"}',
        });

        // apiRequestPublic should throw the auth error directly
        await expect(service.apiRequestPublic('/system/identity')).rejects.toThrow(
            /Authentication failed \(401\)/
        );
    });

    it('[BUG-FIX] getMikroTikService warns when router has no password in DB', async () => {
        const loggerWarnSpy = jest.spyOn(require('@/lib/logger').default, 'warn').mockImplementation(() => {});
        const unscopedFindUnique = jest.fn().mockResolvedValue({
            id: 'router-nopass',
            tenantId: 'tenant-1',
            host: '10.0.0.50',
            wgTunnelIp: '10.0.0.50',
            wgEnabled: true,
            port: 8728,
            username: 'admin',
            password: null,   // ← no password in DB
        });

        (getTenantClient as jest.Mock).mockImplementation((tenantId?: string | null) => ({
            routerLog: { create: mockRouterLogCreate },
            router: {
                update: mockRouterUpdate,
                findUnique: tenantId === null ? unscopedFindUnique : jest.fn().mockResolvedValue(null),
            },
        }));

        await getMikroTikService('router-nopass', 'tenant-1');

        // Should warn about missing password that will cause 401
        expect(loggerWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('no password set in the database')
        );
        loggerWarnSpy.mockRestore();
    });
});

