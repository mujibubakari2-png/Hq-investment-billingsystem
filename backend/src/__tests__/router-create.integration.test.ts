import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getTenantClient } from '@/lib/tenantPrisma';

const route = require('@/app/api/routers/route');

describe('router creation flow from frontend payload to database', () => {
  let planId: string;
  let tenantId: string;

  beforeEach(async () => {
    await prisma.routerLog.deleteMany({});
    await prisma.radiusNas.deleteMany({});
    await prisma.router.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.saasPlan.deleteMany({});

    const plan = await prisma.saasPlan.create({
      data: {
        name: 'Router Flow Plan',
        price: 0,
        pppoeLimit: 20,
        hotspotLimit: 20,
        maxRouters: 5,
      },
    });
    planId = plan.id;

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Router Flow Tenant',
        email: `router-flow-${Date.now()}@example.com`,
        slug: `router-flow-${Date.now()}`,
        planId,
      },
    });
    tenantId = tenant.id;
  });

  afterEach(async () => {
    await prisma.routerLog.deleteMany({});
    await prisma.radiusNas.deleteMany({});
    await prisma.router.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.saasPlan.deleteMany({});
  });

  it('persists a router created from the frontend payload into the tenant-scoped database', async () => {
    const token = signToken({
      userId: 'admin-1',
      username: 'admin-1',
      role: 'ADMIN',
      tenantId,
    });

    const req = new NextRequest('http://localhost/api/routers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Frontend-Router-01',
        host: '192.168.88.1',
        username: 'admin',
        password: 'StrongPass123!',
        port: 8728,
        apiPort: 8728,
        vpnMode: 'hybrid',
        description: 'Created from frontend payload',
      }),
    });

    const res = await route.POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe('Frontend-Router-01');

    const db = getTenantClient(tenantId);
    const createdRouter = await db.router.findFirst({
      where: { name: 'Frontend-Router-01' },
      include: { logs: true },
    });

    expect(createdRouter).not.toBeNull();
    expect(createdRouter?.tenantId).toBe(tenantId);
    expect(createdRouter?.host).toBe('192.168.88.1');
    expect(createdRouter?.password).toBeDefined();
    expect(createdRouter?.radiusSecret).toBeDefined();
    expect(createdRouter?.logs).toHaveLength(1);

    const nas = await db.radiusNas.findFirst({ where: { tenantId } });
    expect(nas).not.toBeNull();
    expect(nas?.shortName).toBe('Frontend-Router-01');
  });
});
