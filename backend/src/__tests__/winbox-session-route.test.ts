import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();
const mockCanAccessTenant = jest.fn();
const mockCreateWinboxSession = jest.fn();
const mockGetSessionByOwner = jest.fn();
const mockDestroySession = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/tenant', () => ({
  canAccessTenant: jest.fn((...args: any[]) => mockCanAccessTenant(...args)),
}));

jest.mock('@/lib/encryption', () => ({
  decryptRouterFields: jest.fn((router: any) => router),
}));

jest.mock('@/lib/winboxProxyManager', () => ({
  createWinboxSession: jest.fn((...args: any[]) => mockCreateWinboxSession(...args)),
  destroySession: jest.fn((...args: any[]) => mockDestroySession(...args)),
  getSessionByOwner: jest.fn((...args: any[]) => mockGetSessionByOwner(...args)),
}));

jest.mock('@/lib/auth', () => ({
  jsonResponse: (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }),
  errorResponse: (message: string, status = 400) => new Response(JSON.stringify({
    success: false,
    error: message,
    message,
    status: 'error',
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }),
}));

jest.mock('@/lib/logger', () => {
  const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { __esModule: true, default: loggerMock };
});

jest.mock('@/lib/routerAddressResolver', () => ({
  resolveRouterManagementTarget: jest.fn(() => ({
    host: '10.0.0.200',
    port: 8291,
    requiresVpn: true,
    reachableFrom: 'INTERNAL_BACKEND',
    instructions: 'Connect via proxy',
  })),
}));

describe('winbox-session POST route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessTenant.mockReturnValue(true);
  });

  it('returns a connectable WinBox session payload for an authorized router', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', userId: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    const router = {
      id: 'router-1',
      name: 'Router One',
      host: '10.0.0.1',
      tenantId: 'tenant-a',
      port: 8728,
    };

    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue(router),
      },
    });

    mockCreateWinboxSession.mockResolvedValue({
      sessionId: 'test-session-id',
      port: 41234,
      idleExpiresAt: Date.now() + 900_000,
      maxLifetimeAt: Date.now() + 3_600_000,
    });

    const req = new NextRequest('http://localhost/api/routers/router-1/winbox-session', {
      method: 'POST',
      headers: { 'x-real-ip': '1.2.3.4' },
      body: JSON.stringify({}),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'router-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.host).toBeDefined();
    expect(typeof body.port).toBe('number');
    expect(body.port).toBeGreaterThan(0);
    expect(body.expiresInSeconds).toBeGreaterThan(0);
    expect(body.sessionId).toBe('test-session-id');
    expect(body.instructions).toContain('WinBox');

    // Verify allowedSourceIp was extracted from x-real-ip and passed to createWinboxSession
    expect(mockCreateWinboxSession).toHaveBeenCalledWith(
      'router-1',
      'user-1',
      'tenant-a',
      '10.0.0.200',  // server-resolved target host — NOT from request body
      8291,
      '1.2.3.4'     // captured from X-Real-IP header
    );
  });

  it('returns 404 when router is not found', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', userId: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    mockGetTenantClient.mockReturnValue({
      router: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    const req = new NextRequest('http://localhost/api/routers/unknown/winbox-session', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'unknown' }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user cannot access router tenant', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-2', userId: 'user-2', role: 'ADMIN', tenantId: 'tenant-b' },
    });

    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({ id: 'router-1', tenantId: 'tenant-a' }),
      },
    });

    mockCanAccessTenant.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/routers/router-1/winbox-session', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'router-1' }) });
    expect(res.status).toBe(403);
  });
});

describe('winbox-session DELETE route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessTenant.mockReturnValue(true);
  });

  it('destroys an owned session successfully', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', userId: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({ id: 'router-1', tenantId: 'tenant-a' }),
      },
    });

    mockGetSessionByOwner.mockReturnValue({ sessionId: 'sess-abc', routerId: 'router-1', userId: 'user-1' });
    mockDestroySession.mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/routers/router-1/winbox-session?sessionId=sess-abc', {
      method: 'DELETE',
    });

    const res = await route.DELETE(req, { params: Promise.resolve({ id: 'router-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDestroySession).toHaveBeenCalledWith('sess-abc');
  });

  it('returns 400 when sessionId is missing', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', userId: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({ id: 'router-1', tenantId: 'tenant-a' }),
      },
    });

    const req = new NextRequest('http://localhost/api/routers/router-1/winbox-session', {
      method: 'DELETE',
    });

    const res = await route.DELETE(req, { params: Promise.resolve({ id: 'router-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when session belongs to a different user (cross-user destroy denied)', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-2', userId: 'user-2', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({ id: 'router-1', tenantId: 'tenant-a' }),
      },
    });

    // getSessionByOwner returns null because user-2 does not own this session
    mockGetSessionByOwner.mockReturnValue(null);

    const req = new NextRequest('http://localhost/api/routers/router-1/winbox-session?sessionId=sess-user1', {
      method: 'DELETE',
    });

    const res = await route.DELETE(req, { params: Promise.resolve({ id: 'router-1' }) });
    expect(res.status).toBe(404);
    expect(mockDestroySession).not.toHaveBeenCalled();
  });
});
