import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export async function GET(
    request: Request,
    context: { params: Promise<{ routerId: string }> }
) {
    const { routerId } = await context.params;

    console.log(`[SYNC] Sync request received for router: ${routerId}`);

    try {
        const router = await prisma.router.findFirst({
            where: {
                OR: [
                    { id: routerId },
                    { name: routerId }
                ]
            }
        });

        if (!router) {
            console.warn(`[SYNC] Router not found: ${routerId}`);
            return NextResponse.json(
                { 
                    status: "error", 
                    message: "Router not found" 
                },
                { status: 404 }
            );
        }

        await prisma.router.update({
            where: { id: router.id },
            data: {
                lastSeen: new Date(),
                status: "ONLINE"
            }
        });

        console.log(`[SYNC] Router ${router.name} (${router.id}) synced successfully`);

        return NextResponse.json(
            {
                status: "ok",
                message: "Sync successful",
                routerId: router.id,
                routerName: router.name,
                timestamp: new Date().toISOString()
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(`[SYNC] Sync failed for router ${routerId}:`, error);
        return NextResponse.json(
            { 
                status: "error", 
                message: "Sync failed" 
            },
            { status: 500 }
        );
    }
}
