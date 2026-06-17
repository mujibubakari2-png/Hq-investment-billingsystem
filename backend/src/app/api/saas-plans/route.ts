import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
    try {
        const db = getTenantClient(null);
        // Only return paid plans — the free trial (price=0) is granted
        // automatically to every new tenant and should NOT appear as
        // a selectable plan on the landing page pricing section.
        const plans = await db.saasPlan.findMany({
            where: { price: { gt: 0 } },
            orderBy: { price: 'asc' },
        });

        return jsonResponse(plans);
    } catch (e) {
        logger.error("Fetch SaaS plans error", { error: (e as Error)?.message });
        return errorResponse("Internal server error", 500);
    }
}

