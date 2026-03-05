import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// POST /api/vouchers/generate - Bulk generate vouchers
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { packageId, routerId, createdById, count = 10, prefix = "" } = body;

        if (!packageId || !createdById) {
            return errorResponse("packageId and createdById are required");
        }

        const vouchers = [];
        for (let i = 0; i < count; i++) {
            const code = prefix + Math.floor(1000 + Math.random() * 9000).toString();

            // Check uniqueness
            const exists = await prisma.voucher.findUnique({ where: { code } });
            if (exists) {
                i--; // retry
                continue;
            }

            const voucher = await prisma.voucher.create({
                data: {
                    code,
                    packageId,
                    routerId,
                    createdById,
                },
            });
            vouchers.push(voucher);
        }

        return jsonResponse({ generated: vouchers.length, vouchers }, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
