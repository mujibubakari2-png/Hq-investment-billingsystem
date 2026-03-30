import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/vouchers
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };
        
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
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
                    package: { select: { name: true, type: true } },
                    router: { select: { name: true } },
                    createdBy: { select: { username: true, fullName: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.voucher.count({ where }),
        ]);

        const formatDate = (d: any) => {
            if (!d) return null;
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return "Invalid Date";
            try {
                return dateObj.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" });
            } catch (e) {
                return dateObj.toDateString(); // Safe fallback
            }
        };

        const mapped = vouchers.map((v: any) => ({
            id: v.id,
            code: v.code,
            plan: v.package?.name,
            router: v.router?.name || "",
            packageType: v.package?.type,
            status: v.status.charAt(0) + v.status.slice(1).toLowerCase(),
            createdBy: v.createdBy?.fullName || v.createdBy?.username || "System",
            createdAt: formatDate(v.createdAt) || "N/A",
            timestamp: new Date(v.createdAt).getTime() || 0, // Fallback raw number for sorting
            usedBy: v.usedBy,
            usedAt: formatDate(v.usedAt),
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
        const { code, packageId, routerId, createdById } = body;

        if (!packageId) return errorResponse("packageId is required");

        let pkg = await prisma.package.findUnique({ where: { id: packageId } });
        if (!pkg) pkg = await prisma.package.findFirst({ where: { name: packageId } });
        if (!pkg) return errorResponse("Package not found", 404);

        // Prefer logged-in user from JWT token, then body, then admin fallback
        const currentUser = getUserFromRequest(req);
        if (!currentUser) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: currentUser.tenantId };
        let finalCreatedById = currentUser?.userId || createdById;
        if (!finalCreatedById) {
            const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
            finalCreatedById = admin?.id;
        }

        if (!finalCreatedById) return errorResponse("Creator user ID is required");

        const finalCode = code || Math.floor(100000 + Math.random() * 900000).toString();
        const tenantIdValue = isSuperAdmin ? (body.tenantId || null) : currentUser.tenantId;

        const voucher = await prisma.voucher.create({
            data: {
                code: finalCode,
                packageId: pkg.id,
                routerId,
                createdById: finalCreatedById,
                tenantId: tenantIdValue
            },
        });

        return jsonResponse(voucher, 201);
    } catch (e: any) {
        console.error("VOUCHER POST ERROR:", e);
        return errorResponse(`Internal server error: ${e.message}`, 500);
    }
}
