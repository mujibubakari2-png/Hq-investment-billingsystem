import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/clients - List all clients
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const serviceType = searchParams.get("serviceType") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (search) {
            where.OR = [
                { username: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status) where.status = status;
        if (serviceType) where.serviceType = serviceType;

        const [clients, total] = await Promise.all([
            prisma.client.findMany({
                where,
                include: {
                    subscriptions: {
                        where: { status: "ACTIVE" },
                        include: { package: true, router: true },
                        take: 1,
                        orderBy: { createdAt: "desc" },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.client.count({ where }),
        ]);

        // Map to a flat format the frontend expects
        const mapped = clients.map((c: {
            id: string;
            username: string;
            fullName: string;
            phone: string | null;
            email: string | null;
            serviceType: string;
            status: string;
            accountType: string;
            createdAt: Date;
            device: string | null;
            macAddress: string | null;
            subscriptions: { package: { name: string } | null; router: { name: string } | null }[];
        }) => {
            const activeSub = c.subscriptions[0];
            return {
                id: c.id,
                username: c.username,
                fullName: c.fullName,
                phone: c.phone || "",
                email: c.email,
                serviceType: c.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                status: c.status.charAt(0) + c.status.slice(1).toLowerCase(),
                accountType: c.accountType === "PERSONAL" ? "Personal" : "Business",
                createdOn: c.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                plan: activeSub?.package?.name,
                router: activeSub?.router?.name,
                device: c.device,
                macAddress: c.macAddress,
            };
        });

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/clients - Create a new client
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, fullName, phone, email, serviceType, accountType, macAddress, device } = body;

        if (!username || !fullName) {
            return errorResponse("Username and full name are required");
        }

        const existing = await prisma.client.findUnique({ where: { username } });
        if (existing) {
            return errorResponse("Username already exists");
        }

        const client = await prisma.client.create({
            data: {
                username,
                fullName,
                phone,
                email,
                serviceType: serviceType === "PPPoE" ? "PPPOE" : "HOTSPOT",
                accountType: accountType === "Business" ? "BUSINESS" : "PERSONAL",
                macAddress,
                device,
            },
        });

        return jsonResponse(client, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
