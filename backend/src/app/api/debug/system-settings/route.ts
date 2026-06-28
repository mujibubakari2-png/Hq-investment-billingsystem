import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.systemSetting.findMany({ where: { key: 'paymentGateways' } });
    return NextResponse.json({ rows });
  } catch (e: any) {
    console.error('[DEBUG_ROUTE] failed to read system_settings:', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
