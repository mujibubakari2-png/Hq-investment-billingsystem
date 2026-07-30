import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/encryption', () => ({
  encryptRouterFields: jest.fn((data) => data),
  encrypt: jest.fn((value) => value),
  decryptRouterFields: jest.fn((value) => value),
}));

jest.mock('@/lib/routerProvisioning', () => ({
  generateRadiusSecret: jest.fn(() => 'radius-secret'),
}));

describe('router update route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates router fields like name correctly', async () => {
    const route = require('@/app/api/routers/[id]/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-1', userId: 'admin-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    const db = {
      router: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'router-1',
          tenantId: 'tenant-a',
          vendor: 'mikrotik',
          type: 'MikroTik',
          firmwareVersion: '6.49.10',
          apiType: 'SSH',
          capabilities: '{}',
          supportedFeatures: '',
          radiusSecret: 'encrypted-secret',
          status: 'OFFLINE',
          host: '10.0.0.1',
          name: 'Router A',
          wgTunnelIp: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'router-1',
          tenantId: 'tenant-a',
          vendor: 'omada',
          type: 'Omada',
          firmwareVersion: '1.32.0',
          apiType: 'REST',
          capabilities: '{}',
          supportedFeatures: 'DHCP,DNS',
          radiusSecret: 'encrypted-secret',
          status: 'OFFLINE',
          host: '10.0.0.1',
          name: 'Router A',
          wgTunnelIp: null,
        }),
      },
      radiusNas: {
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers/router-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Router Name' }),
    });

    const res = await route.PUT(req, { params: Promise.resolve({ id: 'router-1' }) });

    expect(res.status).toBe(200);
    expect(db.router.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'New Router Name',
      }),
    }));
  });
});
