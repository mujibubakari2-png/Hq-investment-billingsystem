import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/transactions
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };
        
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const type = searchParams.get("type") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
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

        const formatDateTime = (d: any) => {
            if (!d) return "N/A";
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return "Invalid Date";
            try {
                return dateObj.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
            } catch (e) {
                return dateObj.toISOString();
            }
        };

        const mapped = transactions.map((t: any) => ({
            id: t.id,
            user: t.client?.username || "Unknown",
            planName: t.planName,
            plan: t.planName, // Add alias for TestSprite
            amount: t.amount,
            type: t.type.charAt(0) + t.type.slice(1).toLowerCase(),
            method: t.method,
            status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
            date: formatDateTime(t.createdAt),
            timestamp: new Date(t.createdAt).getTime() || 0, // Safe numerical value for deterministic sorting
            expiryDate: t.expiryDate || null,
            reference: t.reference,
        }));

        let mobileStats = null;
        if (type.toUpperCase() === "MOBILE") {
            const stats = (await prisma.transaction.groupBy({
                by: ['status'],
                where: { type: 'MOBILE', ...tenantFilter },
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };
        
        const body = await req.json();

        // Resolve client ID natively if a username was provided instead
        let clientId = body.clientId;
        if (!clientId && body.username) {
            const client = await prisma.client.findFirst({
                where: {
                    OR: [
                        { username: body.username },
                        { phone: body.username }
                    ],
                    ...tenantFilter
                }
            });
            if (client) {
                clientId = client.id;
            } else {
                return errorResponse("Client not found based on the provided username/phone.", 404);
            }
        }

        // Resolve plan name natively if a planId was provided instead
        let planName = body.planName;
        if (!planName && body.planId) {
            const plan = await prisma.package.findUnique({ where: { id: body.planId } });
            if (plan && (isSuperAdmin || plan.tenantId === userPayload.tenantId)) {
                planName = plan.name;
            }
        }

        if (!clientId) return errorResponse("Client ID or Username is required", 400);

        const tenantIdValue = isSuperAdmin ? (body.tenantId || null) : userPayload.tenantId;

        const transaction = await prisma.transaction.create({
            data: {
                clientId: clientId,
                planName: planName || "Manual Transaction",
                amount: parseFloat(body.amount),
                type: (body.type || "MANUAL").toUpperCase(),
                method: body.method || "Cash",
                status: (body.status || "COMPLETED").toUpperCase(),
                reference: body.reference || `TXN-${Date.now()}`,
                expiryDate: body.expiryDate,
                tenantId: tenantIdValue
            },
        });

        return jsonResponse(transaction, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
