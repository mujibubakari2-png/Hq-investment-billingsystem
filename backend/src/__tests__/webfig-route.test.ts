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

describe('webfig route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a fallback WebFig page for an authorized router', async () => {
    const route = require('@/app/api/routers/[id]/webfig/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });

    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'router-1',
          name: 'Router One',
          host: '10.0.0.1',
          tenantId: 'tenant-a',
        }),
      },
    });

    const req = new NextRequest('http://localhost/api/routers/router-1/webfig', {
      method: 'GET',
    });

    const res = await route.GET(req, { params: Promise.resolve({ id: 'router-1' }) });
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('Open WebFig');
    expect(text).toContain('10.0.0.1');
  });
});
