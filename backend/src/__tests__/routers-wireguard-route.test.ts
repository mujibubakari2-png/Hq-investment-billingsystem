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
const mockDecryptRouterFields = jest.fn();
const mockEncryptRouterFields = jest.fn((data) => data);

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/tenant', () => ({
  canAccessTenant: jest.fn((...args: any[]) => mockCanAccessTenant(...args)),
}));

jest.mock('@/lib/wireguard', () => ({
  wireguardManager: {
    getServerIp: jest.fn((...args: any[]) => mockGetServerIp(...args)),
    generatePrivateKey: jest.fn((...args: any[]) => mockGeneratePrivateKey(...args)),
    derivePublicKey: jest.fn((...args: any[]) => mockDerivePublicKey(...args)),
    getServerPublicKey: jest.fn((...args: any[]) => mockGetServerPublicKey(...args)),
    listPeers: jest.fn((...args: any[]) => mockListPeers(...args)),
  },
}));

jest.mock('@/lib/encryption', () => ({
  decryptRouterFields: jest.fn((...args: any[]) => mockDecryptRouterFields(...args)),
  encryptRouterFields: jest.fn((...args: any[]) => mockEncryptRouterFields(...args)),
}));

describe('WireGuard route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WG_SERVER_PUBLIC_KEY = '';
    process.env.WG_SERVER_ENDPOINT = '';
    process.env.WG_SERVER_PORT = '';
    process.env.SERVER_PUBLIC_IP = '';
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

  it('assigns a WireGuard tunnel IP and generates keys on GET config', async () => {
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
    expect(body.routerPublicKey).toBe('public-key-1');
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
});
