import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// All jest.mock() calls are hoisted to top-of-file by Babel/ts-jest regardless
// of where they appear in source order. We use factory functions so each
// jest.resetModules() in beforeEach gets fresh instances.

const mockRequirePermission = jest.fn();
const mockGetTenantClient = jest.fn();
const mockCanAccessTenant = jest.fn(() => true);

jest.mock('@/lib/rbac', () => ({
  requirePermission: (...args: any[]) => mockRequirePermission(...args),
}));

jest.mock('@/lib/tenantPrisma', () => ({
  getTenantClient: (...args: any[]) => mockGetTenantClient(...args),
}));

jest.mock('@/lib/tenant', () => ({
  canAccessTenant: (...args: any[]) => mockCanAccessTenant(...args),
}));

// Logger mock — must match default export shape used by the route
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  jsonResponse: (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  errorResponse: (message: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error: message, message, status: 'error' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('webfig route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessTenant.mockReturnValue(true);
  });

  it('returns JSON with a secure proxy URL for a direct-IP (WAN) router', async () => {
    const { GET } = require('@/app/api/routers/[id]/webfig/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });
    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'router-1',
          name: 'Router One',
          host: '203.0.113.1',   // public WAN IP — not a VPN IP
          wgEnabled: false,
          wgTunnelIp: null,
          tenantId: 'tenant-a',
        }),
      },
    });

    const req = new NextRequest('http://localhost/api/routers/router-1/webfig', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: 'router-1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.browserReachable).toBe(true);
    expect(json.webfigUrl).toMatch(/^http:\/\/localhost:\d+\/webfig\/$/);
    expect(json.sessionId).toBeDefined();
    expect(json.accessNote).toContain('secure WebFig gateway');
  });

  it('returns JSON with a secure proxy URL for a WireGuard router with private VPN IP', async () => {
    const { GET } = require('@/app/api/routers/[id]/webfig/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });
    mockGetTenantClient.mockReturnValue({
      router: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'router-1',
          name: 'Router One',
          host: '10.200.0.200',  // WireGuard VPN tunnel IP — private RFC-1918
          wgEnabled: true,
          wgTunnelIp: '10.200.0.200',
          tenantId: 'tenant-a',
        }),
      },
    });

    const req = new NextRequest('http://localhost/api/routers/router-1/webfig', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: 'router-1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    // New route securely proxies ALL connections, so browser is always reachable via proxy.
    expect(json.browserReachable).toBe(true);
    expect(json.webfigUrl).toMatch(/^http:\/\/localhost:\d+\/webfig\/$/);
    expect(json.sessionId).toBeDefined();
    expect(json.accessNote).toContain('secure WebFig gateway');
  });

  it('returns 404 when the router does not exist', async () => {
    const { GET } = require('@/app/api/routers/[id]/webfig/route');

    mockRequirePermission.mockReturnValue({
      error: null,
      user: { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-a' },
    });
    mockGetTenantClient.mockReturnValue({
      router: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    const req = new NextRequest('http://localhost/api/routers/bad-id/webfig', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: 'bad-id' }) });
    expect(res.status).toBe(404);
  });
});
