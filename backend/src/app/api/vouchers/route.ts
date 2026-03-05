import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/vouchers
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
            where.OR = [
                { code: { contains: search, mode: "insensitive" } },
                { usedBy: { contains: search, mode: "insensitive" } },
            ];
        }

        const [vouchers, total] = await Promise.all([
            prisma.voucher.findMany({
                where,
                include: {
                    package: { select: { name: true } },
                    router: { select: { name: true } },
                    createdBy: { select: { username: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.voucher.count({ where }),
        ]);

        const mapped = vouchers.map((v: {
            id: string;
            code: string;
            package: { name: string };
            router: { name: string } | null;
            status: string;
            createdBy: { username: string };
            createdAt: Date;
            usedBy: string | null;
            usedAt: Date | null;
            customer: number | null;
        }) => ({
            id: v.id,
            code: v.code,
            plan: v.package.name,
            router: v.router?.name || "",
            packageType: v.package.name,
            status: v.status.charAt(0) + v.status.slice(1).toLowerCase(),
            createdBy: v.createdBy.username,
            createdAt: v.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            usedBy: v.usedBy,
            usedAt: v.usedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            customer: v.customer,
        }));

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/vouchers - single voucher creation
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const voucher = await prisma.voucher.create({
            data: {
                code: body.code,
                packageId: body.packageId,
                routerId: body.routerId,
                createdById: body.createdById,
            },
        });

        return jsonResponse(voucher, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
