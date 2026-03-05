import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/subscriptions
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (status) where.status = status;
        if (search) {
            where.client = {
                OR: [
                    { username: { contains: search, mode: "insensitive" } },
                    { fullName: { contains: search, mode: "insensitive" } },
                ],
            };
        }

        const [subs, total] = await Promise.all([
            prisma.subscription.findMany({
                where,
                include: {
                    client: true,
                    package: true,
                    router: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.subscription.count({ where }),
        ]);

        return jsonResponse({ data: subs, total, page, limit });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/subscriptions
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const sub = await prisma.subscription.create({
            data: {
                clientId: body.clientId,
                packageId: body.packageId,
                routerId: body.routerId,
                method: body.method,
                expiresAt: new Date(body.expiresAt),
                activatedAt: body.activatedAt ? new Date(body.activatedAt) : new Date(),
            },
            include: { client: true, package: true, router: true },
        });

        return jsonResponse(sub, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
