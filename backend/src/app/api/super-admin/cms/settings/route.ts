import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

// GET /api/super-admin/cms/settings
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, "SUPER_ADMIN");
    if (auth.error) return auth.error;

    const settings = await prisma.storeSetting.findMany();
    
    // Convert array of {key, value} into a single object { [key]: value }
    const formattedSettings = settings.reduce((acc: Record<string, any>, curr: { key: string; value: any }) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({ data: formattedSettings });
  } catch (error: any) {
    console.error('Fetch store settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/super-admin/cms/settings
export async function PUT(req: NextRequest) {
  try {
    const auth = requireRole(req, "SUPER_ADMIN");
    if (auth.error) return auth.error;

    const body = await req.json();

    // Body should be an object of key-value pairs
    // Update or create each setting
    const promises = Object.entries(body).map(([key, value]) => {
      return prisma.storeSetting.upsert({
        where: { key },
        update: { value: value || {} },
        create: { key, value: value || {} },
      });
    });

    await Promise.all(promises);

    return NextResponse.json({ message: 'Settings updated successfully' });
  } catch (error: any) {
    console.error('Update store settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
