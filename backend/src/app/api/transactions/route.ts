import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/transactions
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const type = searchParams.get("type") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (status) where.status = status.toUpperCase();
        if (type) where.type = type.toUpperCase();
        if (search) {
            where.OR = [
                { reference: { contains: search, mode: "insensitive" } },
                { client: { username: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                include: { client: { select: { username: true, fullName: true } } },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.transaction.count({ where }),
        ]);

        const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

        const mapped = transactions.map((t: {
            id: string;
            client: { username: string; fullName: string };
            planName: string | null;
            amount: number;
            type: string;
            method: string;
            status: string;
            createdAt: Date;
            expiryDate: string | null;
            reference: string;
        }) => ({
            id: t.id,
            user: t.client.username,
            planName: t.planName,
            plan: t.planName, // Add alias for TestSprite
            amount: t.amount,
            type: t.type.charAt(0) + t.type.slice(1).toLowerCase(),
            method: t.method,
            status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
            date: isValidDate(t.createdAt) ? t.createdAt.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A",
            createdAt: t.createdAt, // Alias for TestSprite
            expiryDate: t.expiryDate,
            reference: t.reference,
        }));

        let mobileStats = null;
        if (type.toUpperCase() === "MOBILE") {
            const stats = (await prisma.transaction.groupBy({
                by: ['status'],
                where: { type: 'MOBILE' },
                _count: { _all: true },
                _sum: { amount: true }
            } as any)) as unknown as any[];

            mobileStats = {
                totalCount: stats.reduce((acc: number, curr: any) => acc + (curr._count?._all || 0), 0),
                totalRevenue: stats.filter((s: any) => s.status === 'COMPLETED').reduce((acc: number, curr: any) => acc + (curr._sum?.amount || 0), 0),
                paid: stats.find((s: any) => s.status === 'COMPLETED')?._count?._all || 0,
                unpaid: stats.find((s: any) => s.status === 'PENDING')?._count?._all || 0,
                failed: stats.find((s: any) => s.status === 'FAILED')?._count?._all || 0,
                canceled: stats.find((s: any) => s.status === 'CANCELED')?._count?._all || 0,
            };
        }

        return jsonResponse({ data: mapped, total, page, limit, stats: mobileStats });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/transactions
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const transaction = await prisma.transaction.create({
            data: {
                clientId: body.clientId,
                planName: body.planName,
                amount: parseFloat(body.amount),
                type: (body.type || "MANUAL").toUpperCase(),
                method: body.method,
                status: (body.status || "COMPLETED").toUpperCase(),
                reference: body.reference || `TXN-${Date.now()}`,
                expiryDate: body.expiryDate,
            },
        });

        return jsonResponse(transaction, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
