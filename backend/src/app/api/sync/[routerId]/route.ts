import { NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";

export async function GET(
    request: Request,
    context: { params: Promise<{ routerId: string }> }
) {
    const { routerId } = await context.params;

    const authHeader = request.headers.get("Authorization");
    const expectedKey = process.env.ROUTER_SYNC_API_KEY;
    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
        return NextResponse.json({ status: "error", message: "Unauthorized router sync" }, { status: 401 });
    }

    console.log(`[SYNC] Sync request received for router: ${routerId}`);

    try {
        const db = getTenantClient(null);
        const router = await db.router.findFirst({
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

        await db.router.update({
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
