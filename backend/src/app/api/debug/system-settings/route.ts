import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const guard = requireRole(req, 'SUPER_ADMIN');
    if (guard.error) return guard.error;

    const rows = await prisma.paymentChannel.findMany({
      select: {
        id: true,
        tenantId: true,
        provider: true,
        name: true,
        status: true,
        environment: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ rows });
  } catch (e: any) {
    console.error('[DEBUG_ROUTE] failed to read payment channels:', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
