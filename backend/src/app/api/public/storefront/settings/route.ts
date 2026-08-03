import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // In a multi-tenant environment, you might fetch settings for a specific tenant,
    // for platform/super-admin landing page, we use null for global/platform DB.
    const settings = await prisma.storeSetting.findMany();
    
    const formattedSettings = settings.reduce((acc: Record<string, any>, curr: { key: string; value: any }) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({ data: formattedSettings });
  } catch (error: any) {
    console.error('Fetch public store settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
