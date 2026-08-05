import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/plans — Fetch SaaS plans from DB and expose to landing page
export async function GET() {
    try {
        // Only return paid plans — the free trial (price=0) is granted
        // automatically to every new tenant and should NOT appear as
        // a selectable plan on the landing page pricing section.
        const plans = await prisma.saasPlan.findMany({
            where: { price: { gt: 0 } },
            orderBy: { price: 'asc' },
        });

        return NextResponse.json(plans);
    } catch (error) {
        console.error('Fetch SaaS plans error:', error);
        // Return empty array instead of error so landing page degrades gracefully
        return NextResponse.json([], { status: 200 });
    }
}
