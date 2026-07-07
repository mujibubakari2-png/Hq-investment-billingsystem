/// <reference types="jest" />

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
  decrypt: jest.fn((value) => value),
}));

jest.mock('@/lib/routerProvisioning', () => ({
  generateRadiusSecret: jest.fn(() => 'radius-secret'),
  generateAdminUsername: jest.fn((name: string) => `admin-${name}`),
}));

describe('router creation route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a router for tenant-scoped admin and injects tenantId from JWT', async () => {
    const route = require('@/app/api/routers/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-1', userId: 'admin-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'router-1',
          name: 'Router A',
          host: '10.0.0.1',
          tenantId: 'tenant-a',
          radiusSecret: 'encrypted-secret',
          status: 'OFFLINE',
          apiPort: 8728,
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-a',
          plan: { maxRouters: 5 },
          routers: [{ id: 'router-0' }],
        }),
      },
      radiusNas: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Router A',
        host: '10.0.0.1',
        password: 'supersecret',
      }),
    });

    const res = await route.POST(req);

    expect(res.status).toBe(201);
    expect(db.router.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        name: 'Router A',
        host: '10.0.0.1',
      }),
    }));
    expect(db.routerLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        action: 'router_created',
      }),
    }));
  });

  it('allows platform super admin to create a router for any tenant when tenantId is provided', async () => {
    const route = require('@/app/api/routers/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'platform-1', userId: 'platform-1', role: 'SUPER_ADMIN', tenantId: null },
    });

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'router-2',
          name: 'Router B',
          host: '10.0.0.2',
          tenantId: 'tenant-b',
          radiusSecret: 'encrypted-secret',
          status: 'OFFLINE',
          apiPort: 8728,
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-b',
          plan: { maxRouters: 5 },
          routers: [],
        }),
      },
      radiusNas: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: 'tenant-b',
        name: 'Router B',
        host: '10.0.0.2',
        password: 'supersecret',
      }),
    });

    const res = await route.POST(req);

    expect(res.status).toBe(201);
    expect(db.router.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-b' }),
    }));
  });

  it('filters routers by search term without pagination', async () => {
    const route = require('@/app/api/routers/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-filter', userId: 'admin-filter', role: 'ADMIN', tenantId: 'tenant-x' },
    });

    const db = {
      router: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'router-5',
            name: 'search-match-router',
            host: '10.0.0.5',
            tenantId: 'tenant-x',
            status: 'OFFLINE',
            apiPort: 8728,
            _count: { packages: 0, subscriptions: 0, logs: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers?search=search-match', {
      method: 'GET',
    });

    const res = await route.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.router.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-x',
        OR: expect.any(Array),
      }),
    }));
    expect(body).toEqual([
      expect.objectContaining({
        id: 'router-5',
        name: 'search-match-router',
        tenant_id: 'tenant-x',
      }),
    ]);
  });

  it('filters routers by search term with pagination', async () => {
    const route = require('@/app/api/routers/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-filter', userId: 'admin-filter', role: 'ADMIN', tenantId: 'tenant-x' },
    });

    const db = {
      router: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'router-6',
            name: 'page-match-router',
            host: '10.0.0.6',
            tenantId: 'tenant-x',
            status: 'OFFLINE',
            apiPort: 8728,
            _count: { packages: 0, subscriptions: 0, logs: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers?page=1&search=page-match&limit=10', {
      method: 'GET',
    });

    const res = await route.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.router.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-x',
        OR: expect.any(Array),
      }),
      skip: 0,
      take: 10,
    }));
    expect(db.router.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-x',
        OR: expect.any(Array),
      }),
    }));
    expect(body).toEqual({
      data: [
        expect.objectContaining({
          id: 'router-6',
          name: 'page-match-router',
          tenant_id: 'tenant-x',
        }),
      ],
      total: 1,
    });
  });

  it('rejects tenant-scoped user from creating a router for another tenant', async () => {
    const route = require('@/app/api/routers/route');
    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'admin-3', userId: 'admin-3', role: 'ADMIN', tenantId: 'tenant-c' },
    });

    const db = {
      router: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'router-3',
          name: 'Router C',
          host: '10.0.0.3',
          tenantId: 'tenant-c',
          radiusSecret: 'encrypted-secret',
          status: 'OFFLINE',
          apiPort: 8728,
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-c',
          plan: { maxRouters: 5 },
          routers: [],
        }),
      },
      radiusNas: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      routerLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockGetTenantClient.mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/routers', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: 'tenant-d',
        name: 'Router C',
        host: '10.0.0.3',
        password: 'supersecret',
      }),
    });

    const res = await route.POST(req);

    expect(res.status).toBe(201);
    expect(db.router.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-c' }),
    }));
  });
});
