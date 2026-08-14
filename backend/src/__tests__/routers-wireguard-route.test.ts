/// <reference types="jest" />

import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();
const mockCanAccessTenant = jest.fn();
const mockGetServerIp = jest.fn();
const mockGeneratePrivateKey = jest.fn();
const mockDerivePublicKey = jest.fn();
const mockGetServerPublicKey = jest.fn();
const mockListPeers = jest.fn();
const mockAddPeer = jest.fn();
const mockCheckPeerHandshake = jest.fn();
const mockDecryptRouterFields = jest.fn();
const mockEncryptRouterFields = jest.fn((data) => data);
const mockGetMikroTikService = jest.fn();
const mockCheckWireGuardReachability = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission.apply(null, args as any[])),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient.apply(null, args as any[])),
}));

jest.mock('@/lib/tenant', () => ({
  canAccessTenant: jest.fn((...args: any[]) => mockCanAccessTenant.apply(null, args as any[])),
}));

jest.mock('@/lib/wireguard', () => ({
  wireguardManager: {
    getServerIp: jest.fn((...args: any[]) => mockGetServerIp.apply(null, args as any[])),
    generatePrivateKey: jest.fn((...args: any[]) => mockGeneratePrivateKey.apply(null, args as any[])),
    derivePublicKey: jest.fn((...args: any[]) => mockDerivePublicKey.apply(null, args as any[])),
    getServerPublicKey: jest.fn((...args: any[]) => mockGetServerPublicKey.apply(null, args as any[])),
    listPeers: jest.fn((...args: any[]) => mockListPeers.apply(null, args as any[])),
    addPeer: jest.fn((...args: any[]) => mockAddPeer.apply(null, args as any[])),
    checkPeerHandshake: jest.fn((...args: any[]) => mockCheckPeerHandshake.apply(null, args as any[])),
  },
}));

jest.mock('@/lib/mikrotik', () => ({
  getMikroTikService: jest.fn((...args: any[]) => mockGetMikroTikService.apply(null, args as any[])),
  sanitizeMikroTikName: jest.fn((name: string) => name),
}));

jest.mock('@/lib/encryption', () => ({
  decryptRouterFields: jest.fn((...args: any[]) => mockDecryptRouterFields.apply(null, args as any[])),
  encryptRouterFields: jest.fn((...args: any[]) => mockEncryptRouterFields.apply(null, args as any[])),
}));

jest.mock('@/lib/wireguardConnectivity', () => ({
  checkWireGuardReachability: jest.fn((...args: any[]) => mockCheckWireGuardReachability.apply(null, args as any[])),
}));

describe('WireGuard route', () => {
  jest.setTimeout(20000);
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WG_SERVER_PUBLIC_KEY = '';
    process.env.WG_SERVER_ENDPOINT = '';
    process.env.WG_SERVER_PORT = '';
    process.env.SERVER_PUBLIC_IP = '';
    mockCheckWireGuardReachability.mockResolvedValue({ ok: false, output: 'Request timed out', reason: 'failed' });
    mockCheckPeerHandshake.mockResolvedValue(true);
  });

  it('uses routers:read guard for GET wireguard config', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-1', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockGetTenantClient.mockReturnValue({
      router: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    const req = new NextRequest('http://localhost/api/routers/router-1/wireguard');
    await route.GET(req, { params: Promise.resolve({ id: 'router-1' }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(req, 'routers:read');
  });

  it('assigns a WireGuard tunnel IP on GET config', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-2', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGeneratePrivateKey
      .mockResolvedValueOnce('private-key-1')
      .mockResolvedValueOnce('preshared-key-1');
    mockDerivePublicKey.mockResolvedValue('public-key-1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');
    mockListPeers.mockResolvedValue([]);
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-1',
      name: 'Router A',
      host: '10.0.0.1',
      tenantId: 'tenant-a',
      wgPrivateKey: null,
      wgPublicKey: null,
      wgPeerPublicKey: null,
      wgPresharedKey: null,
      wgTunnelIp: null,
      wgServerEndpoint: null,
      wgListenPort: null,
      wgEnabled: false,
      wgConfiguredAt: null,
    });

    const updateMock = jest.fn().mockResolvedValue({});
    const findManyMock = jest.fn().mockResolvedValue([]);
    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: findManyMock,
        update: updateMock,
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers/router-1/wireguard');
    const res = await route.GET(req, { params: Promise.resolve({ id: 'router-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.routerTunnelIp).toBe('10.200.0.200');
    expect(body.routerPublicKey).toBeNull();
    expect(body.serverPublicKey).toBe('server-public-key');
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { not: 'router-1' }, wgTunnelIp: { not: null } },
      select: { wgTunnelIp: true },
    }));
    expect(updateMock).toHaveBeenCalled();
  });

  it('returns 403 when tenant access is denied for wireguard config', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-3', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(false);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-2',
      name: 'Router B',
      host: '10.0.0.2',
      tenantId: 'tenant-b',
      wgPrivateKey: null,
      wgPublicKey: null,
      wgPeerPublicKey: null,
      wgPresharedKey: null,
      wgTunnelIp: null,
      wgServerEndpoint: null,
      wgListenPort: null,
      wgEnabled: false,
      wgConfiguredAt: null,
    });

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers/router-2/wireguard');
    const res = await route.GET(req, { params: Promise.resolve({ id: 'router-2' }) });

    expect(res.status).toBe(403);
  });

  it('uses the public server endpoint when activating WireGuard from the app', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-4', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');
    process.env.APP_URL = 'https://vpn.example.com';
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-3',
      name: 'Router C',
      host: '10.0.0.3',
      tenantId: 'tenant-a',
      wgPrivateKey: 'router-private-key',
      wgPublicKey: 'router-public-key',
      wgPeerPublicKey: 'server-public-key',
      wgPresharedKey: 'preshared-key',
      wgTunnelIp: '10.200.0.200',
      wgServerEndpoint: null,
      wgListenPort: 51820,
      wgEnabled: false,
      wgConfiguredAt: null,
      username: 'admin',
      password: 'admin',
      port: 8728,
      apiPort: 8728,
      radiusSecret: 'test-secret',
    });

    const service = {
      apiRequestPublic: jest.fn().mockImplementation(async (ep: string, method?: string) => {
        if (ep === '/interface/wireguard/peers' && (!method || method === 'GET')) {
          return [{ "public-key": "server-public-key", interface: "wg-hq", "allowed-address": "10.200.0.0/24" }];
        }
        if (ep === '/ip/route' && (!method || method === 'GET')) {
            return [{ "dst-address": "0.0.0.0/0", interface: "ether1", active: "true" }];
        }
        return [];
      }),
    };
    mockGetMikroTikService.mockResolvedValue(service);

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      radiusNas: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const { executePushConfig } = require('@/lib/pushConfigExecutor');
    await executePushConfig('router-3', 'tenant-a', { lanPorts: [] });

    const peerCall = service.apiRequestPublic.mock.calls.find((call: any) =>
      call[0] === '/interface/wireguard/peers' && call[1] === 'PUT'
    );

    expect(peerCall).toBeDefined();
    expect(peerCall?.[2]?.['endpoint-address']).toBe('vpn.example.com');
  });

  it('allows input traffic from the WireGuard interface so the tunnel can respond to ping and management traffic', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-4', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-4',
      name: 'Router D',
      host: '10.0.0.4',
      tenantId: 'tenant-a',
      wgPrivateKey: 'router-private-key',
      wgPublicKey: 'router-public-key',
      wgPeerPublicKey: 'server-public-key',
      wgPresharedKey: 'preshared-key',
      wgTunnelIp: '10.200.0.200',
      wgServerEndpoint: 'vpn.example.com',
      wgListenPort: 51820,
      wgEnabled: false,
      wgConfiguredAt: null,
      username: 'admin',
      password: 'admin',
      port: 8728,
      apiPort: 8728,
      radiusSecret: 'test-secret',
    });

    const service = {
      apiRequestPublic: jest.fn().mockImplementation(async (ep: string, method?: string) => {
        if (ep === '/interface/wireguard/peers' && (!method || method === 'GET')) {
          return [{ "public-key": "server-public-key", interface: "wg-hq", "allowed-address": "10.200.0.0/24" }];
        }
        if (ep === '/ip/route' && (!method || method === 'GET')) {
            return [{ "dst-address": "0.0.0.0/0", interface: "ether1", active: "true" }];
        }
        return [];
      }),
    };
    mockGetMikroTikService.mockResolvedValue(service);

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      radiusNas: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const { executePushConfig } = require('@/lib/pushConfigExecutor');
    await executePushConfig('router-4', 'tenant-a', { lanPorts: [] });

    const wgInputRule = service.apiRequestPublic.mock.calls.find((call: any) =>
      call[0] === '/ip/firewall/filter' && call[1] === 'PUT' && call[2]?.chain === 'input' && call[2]?.['in-interface'] === 'wg-hq' && call[2]?.action === 'accept'
    );

    expect(wgInputRule).toBeDefined();
  });

  it('uses a /24 tunnel address when pushing WireGuard config to MikroTik', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-4', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-3',
      name: 'Router C',
      host: '10.0.0.3',
      tenantId: 'tenant-a',
      wgPrivateKey: 'router-private-key',
      wgPublicKey: 'router-public-key',
      wgPeerPublicKey: 'server-public-key',
      wgPresharedKey: 'preshared-key',
      wgTunnelIp: '10.200.0.200',
      wgServerEndpoint: 'vpn.example.com',
      wgListenPort: 51820,
      wgEnabled: false,
      wgConfiguredAt: null,
      username: 'admin',
      password: 'admin',
      radiusSecret: 'mock-radius-secret',
      port: 8728,
      apiPort: 8728,
    });

    const service = {
      apiRequestPublic: jest.fn().mockImplementation(async (ep: string, method?: string) => {
        if (ep === '/interface/wireguard/peers' && (!method || method === 'GET')) {
          return [{ "public-key": "server-public-key", interface: "wg-hq", "allowed-address": "10.200.0.0/24" }];
        }
        if (ep === '/ip/route' && (!method || method === 'GET')) {
            return [{ "dst-address": "0.0.0.0/0", interface: "ether1", active: "true" }];
        }
        return [];
      }),
    };
    mockGetMikroTikService.mockResolvedValue(service);

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const { executePushConfig } = require('@/lib/pushConfigExecutor');
    await executePushConfig('router-3', 'tenant-a', { lanPorts: [] });

    const wgAddressCall = service.apiRequestPublic.mock.calls.find((call: any) =>
      call[0] === '/ip/address' && call[1] === 'PUT' && call[2]?.address === '10.200.0.200/24'
    );

    expect(wgAddressCall).toBeDefined();
    expect(wgAddressCall?.[2]).not.toHaveProperty('network');
  });

  it('treats a verified WireGuard handshake as success even when ICMP ping fails', async () => {
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-5', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');
    mockCheckPeerHandshake.mockResolvedValue(true);
    mockAddPeer.mockResolvedValue({ success: true });
    mockCheckWireGuardReachability.mockResolvedValue({ ok: false, output: 'Request timed out', reason: 'failed' });
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-5',
      name: 'Router E',
      host: '10.0.0.5',
      tenantId: 'tenant-a',
      wgPrivateKey: 'router-private-key',
      wgPublicKey: 'router-public-key',
      wgPeerPublicKey: 'server-public-key',
      wgPresharedKey: 'preshared-key',
      wgTunnelIp: '10.200.0.200',
      wgServerEndpoint: 'vpn.example.com',
      wgListenPort: 51820,
      wgEnabled: false,
      wgConfiguredAt: null,
      username: 'admin',
      password: 'admin',
      radiusSecret: 'mock-radius-secret',
      port: 8728,
      apiPort: 8728,
    });

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers/router-5/wireguard', {
      method: 'POST',
      body: JSON.stringify({ action: 'activate' }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'router-5' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.tunnelVerified).toBe(true);
    expect(body.message).toContain('WireGuard tunnel established');
    expect(body.message).toContain('WireGuard handshake');
  });

  // ── BUG FIX REGRESSION TESTS ────────────────────────────────────────────────

  it('[BUG-FIX] push-config throws ROUTER_CREDENTIALS_MISSING when DB has no credentials (prevents silent fallback drift → 401)', async () => {
    // ROOT CAUSE: old code used `password: router.password || "admin"`.
    // When DB password is null, this changed RouterOS admin password to "admin"
    // WITHOUT updating the DB, so next connection used "" → 401 forever.
    //
    // NEW BEHAVIOR (stronger): executePushConfig now THROWS ROUTER_CREDENTIALS_MISSING
    // immediately when username or password is missing, so /user is never called at all.
    // This is strictly safer than the previous "skip silently" behavior.
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-drift', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');

    // Router has NO password in DB — the bug scenario
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-nodrift',
      name: 'Router NoDrift',
      host: '10.0.0.10',
      tenantId: 'tenant-a',
      wgPrivateKey: 'router-private-key',
      wgPublicKey: 'router-public-key',
      wgPeerPublicKey: 'server-public-key',
      wgPresharedKey: 'preshared-key',
      wgTunnelIp: '10.200.0.200',
      wgServerEndpoint: 'vpn.example.com',
      wgListenPort: 51820,
      wgEnabled: false,
      wgConfiguredAt: null,
      username: null,    // ← no username in DB
      password: null,    // ← no password in DB — the bug scenario
      radiusSecret: 'mock-radius-secret',
      port: 8728,
      apiPort: 8728,
    });

    const service = {
      apiRequestPublic: jest.fn().mockResolvedValue([]),
    };
    mockGetMikroTikService.mockResolvedValue(service);

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      routerLog: { create: jest.fn().mockResolvedValue({}) },
    };
    mockGetTenantClient.mockReturnValue(db);

    const { executePushConfig } = require('@/lib/pushConfigExecutor');

    // CRITICAL: function must throw ROUTER_CREDENTIALS_MISSING, not silently complete.
    // This hard stop is strictly safer than the old "skip /user call" behavior because
    // it prevents any RouterOS config from being pushed with unknown auth context.
    await expect(
      executePushConfig('router-nodrift', 'tenant-a', { lanPorts: [] })
    ).rejects.toThrow('ROUTER_CREDENTIALS_MISSING');

    // /user PATCH or PUT must never be reached (thrown before it)
    const userMutationCall = service.apiRequestPublic.mock.calls.find((call: any) =>
      call[0] === '/user' && (call[1] === 'PATCH' || call[1] === 'PUT')
    );
    expect(userMutationCall).toBeUndefined();
  });

  it('[BUG-FIX] push-config DOES update /user when DB has valid username AND password', async () => {
    // When credentials exist in DB, push-config should push them to RouterOS
    const route = require('@/app/api/routers/[id]/wireguard/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-creds', tenantId: 'tenant-a', role: 'ADMIN' },
    });
    mockCanAccessTenant.mockReturnValue(true);
    mockGetServerIp.mockResolvedValue('10.200.0.1');
    mockGetServerPublicKey.mockResolvedValue('server-public-key');

    // Router HAS valid credentials in DB
    mockDecryptRouterFields.mockReturnValue({
      id: 'router-withcreds',
      name: 'Router WithCreds',
      host: '10.0.0.20',
      tenantId: 'tenant-a',
      wgPrivateKey: 'router-private-key',
      wgPublicKey: 'router-public-key',
      wgPeerPublicKey: 'server-public-key',
      wgPresharedKey: 'preshared-key',
      wgTunnelIp: '10.200.0.200',
      wgServerEndpoint: 'vpn.example.com',
      wgListenPort: 51820,
      wgEnabled: false,
      wgConfiguredAt: null,
      username: 'hq_router_admin',   // valid deterministic username
      password: 'SecurePass!99',     // ← valid password
      radiusSecret: 'mock-radius-secret',
      port: 8728,
      apiPort: 8728,
    });

    // Mock /user GET to return an existing "admin" user
    const service = {
      apiRequestPublic: jest.fn().mockImplementation((path: string, method: string) => {
        if (path === '/interface/wireguard/peers' && (!method || method === 'GET')) {
          return Promise.resolve([{ "public-key": "server-public-key", interface: "wg-hq", "allowed-address": "10.200.0.0/24" }]);
        }
        if (path === '/ip/route' && (!method || method === 'GET')) {
          return Promise.resolve([{ "dst-address": "0.0.0.0/0", interface: "ether1", active: "true" }]);
        }
        if (path === '/user' && (!method || method === 'GET')) {
          return Promise.resolve([{ '.id': '*1', name: 'admin' }]);
        }
        return Promise.resolve([]);
      }),
    };
    mockGetMikroTikService.mockResolvedValue(service);

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      routerLog: { create: jest.fn().mockResolvedValue({}) },
    };
    mockGetTenantClient.mockReturnValue(db);

    const { executePushConfig } = require('@/lib/pushConfigExecutor');
    await executePushConfig('router-withcreds', 'tenant-a', { lanPorts: [] });

    // /user PATCH should have been called with the DB credentials (no fallback)
    const userPatchCall = service.apiRequestPublic.mock.calls.find((call: any) =>
      call[0] === '/user' && call[1] === 'PATCH'
    );
    expect(userPatchCall).toBeDefined();
    expect(userPatchCall?.[2]?.name).toBe('hq_router_admin');
    expect(userPatchCall?.[2]?.password).toBe('SecurePass!99');
    // Must NOT fall back to "admin" for either field
    expect(userPatchCall?.[2]?.name).not.toBe('admin');
    expect(userPatchCall?.[2]?.password).not.toBe('admin');
  });
});

