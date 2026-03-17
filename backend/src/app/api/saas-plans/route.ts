import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const plans = await prisma.saasPlan.findMany({
            orderBy: { price: 'asc' }
        });
        
        return jsonResponse(plans);
    } catch (e) {
        console.error("FETCH PLANS ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
