import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const router = await prisma.router.findFirst();
        if (!router) return Response.json({ error: 'No router found' });
        
        const data = {
            primaryColor: '#1a1a2e',
            accentColor: '#6366f1',
            selectedFont: 'Inter',
            layout: 'grid',
            enableAds: false,
            adMessage: 'Welcome to our hotspot!',
            enableRememberMe: true,
            companyName: 'Test',
            customerCareNumber: ''
        };
        
        const settings = await prisma.hotspotSettings.upsert({
            where: { routerId: router.id },
            update: {
                ...data,
            },
            create: {
                routerId: router.id,
                ...data,
                tenantId: null, // Test with null tenant
            },
        });
        
        return Response.json({ success: true, settings });
    } catch (e: any) {
        return Response.json({ error: true, message: e.message, stack: e.stack });
    }
}
