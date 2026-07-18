import { NextRequest } from 'next/server';

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();

jest.mock('@/lib/rbac', () => ({
  requirePermission: jest.fn((...args: any[]) => mockRequirePermission(...args)),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: jest.fn((...args: any[]) => mockGetTenantClient(...args)),
}));

jest.mock('@/lib/tenant', () => ({
  canAccessTenant: jest.fn(() => true),
}));

jest.mock('@/lib/encryption', () => ({
  decryptRouterFields: jest.fn((router: any) => router),
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

describe('winbox session route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a connectable WinBox session payload for an authorized router', async () => {
    const route = require('@/app/api/routers/[id]/winbox-session/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
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

    const req = new NextRequest('http://localhost/api/routers/router-1/winbox-session', {
      method: 'POST',
      body: JSON.stringify({ winboxPort: 8291 }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'router-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.host).toBe('10.0.0.1');
    expect(body.port).toBe(8291);
    expect(body.expiresInSeconds).toBeGreaterThan(0);
    expect(body.instructions).toContain('WinBox');
  });
});
