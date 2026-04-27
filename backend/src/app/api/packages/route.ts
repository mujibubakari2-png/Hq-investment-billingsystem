import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { createPackageSchema, validateData } from "@/lib/validation";

// GET /api/packages
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "";
        const status = searchParams.get("status") || "";
        const routerId = searchParams.get("routerId") || "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (type) {
            const mappedType = type.toUpperCase() === "HOTSPOT" ? "HOTSPOT" : (type.toUpperCase() === "PPPOE" ? "PPPOE" : type);
            where.type = mappedType;
        }
        if (status) {
            const mappedStatus = status.toUpperCase() === "ACTIVE" ? "ACTIVE" : (status.toUpperCase() === "INACTIVE" ? "INACTIVE" : status);
            where.status = mappedStatus;
        }
        if (routerId) where.routerId = routerId;

        const packages = await prisma.package.findMany({
            where,
            include: { router: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        });

        const mapped = packages.map((p: {
            id: string;
            name: string;
            type: string;
            category: string;
            uploadSpeed: number;
            uploadUnit: string;
            downloadSpeed: number;
            downloadUnit: string;
            price: number;
            router: { name: string } | null;
            duration: number;
            durationUnit: string;
            status: string;
            burstEnabled: boolean;
            hotspotType: string | null;
            devices: number | null;
            paymentType: string;
        }) => ({
            id: p.id,
            name: p.name,
            type: p.type === "HOTSPOT" ? "Hotspot" : "PPPoE",
            category: p.category === "PERSONAL" ? "Personal" : "Business",
            bandwidth: `${p.uploadSpeed}${p.uploadUnit[0]}/${p.downloadSpeed}${p.downloadUnit[0]}`,
            uploadSpeed: p.uploadSpeed,
            uploadUnit: p.uploadUnit,
            downloadSpeed: p.downloadSpeed,
            downloadUnit: p.downloadUnit,
            price: p.price,
            router: p.router?.name || "",
            validity: `${p.duration} ${p.durationUnit.charAt(0) + p.durationUnit.slice(1).toLowerCase()}`,
            duration: p.duration,
            durationUnit: p.durationUnit.charAt(0) + p.durationUnit.slice(1).toLowerCase(),
            status: p.status === "ACTIVE" ? "Active" : "Inactive",
            burstEnabled: p.burstEnabled,
            hotspotType: p.hotspotType === "DATA_CAPPED" ? "Data-capped" : "Unlimited",
            devices: p.devices,
            paymentType: p.paymentType === "POSTPAID" ? "Postpaid" : "Prepaid",
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/packages
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const tenantFilter = { tenantId: userPayload.tenantId };

        const body = await req.json();

        // Normalize frontend display values → schema enum values before validation
        const normalized = {
            ...body,
            type: body.type === "PPPoE" ? "PPPOE" : body.type === "Hotspot" ? "HOTSPOT" : (body.type || "").toUpperCase(),
            category: body.category === "Business" ? "BUSINESS" : body.category === "Personal" ? "PERSONAL" : (body.category || "").toUpperCase(),
            paymentType: body.paymentType === "Postpaid" ? "POSTPAID" : body.paymentType === "Prepaid" ? "PREPAID" : (body.paymentType || "").toUpperCase(),
            durationUnit: (body.durationUnit || "").toUpperCase(),
            hotspotType: body.hotspotType === "Data-capped" ? "DATA_CAPPED" : body.hotspotType === "Unlimited" ? "UNLIMITED" : body.hotspotType,
            // Ensure numeric fields are numbers (frontend may send strings)
            uploadSpeed: body.uploadSpeed !== undefined ? Number(body.uploadSpeed) : undefined,
            downloadSpeed: body.downloadSpeed !== undefined ? Number(body.downloadSpeed) : undefined,
            price: body.price !== undefined ? Number(body.price) : undefined,
            duration: body.duration !== undefined ? parseInt(String(body.duration)) : undefined,
            devices: body.devices !== undefined ? parseInt(String(body.devices)) : undefined,
        };

        // Validate input
        const validation = validateData(createPackageSchema, normalized);
        if (!validation.success) {
            console.error("[PACKAGE VALIDATION FAILED]:", validation.errors, "| Input:", JSON.stringify(normalized));
            return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        const validatedData = validation.data;

        let routerId = validatedData.routerId;
        if (routerId) {
            const router = await prisma.router.findFirst({
                where: {
                    OR: [
                        { id: routerId },
                        { name: routerId }
                    ],
                    ...tenantFilter
                }
            });
            if (!router) return errorResponse("Router not found or you don't have permission to use it", 404);
            routerId = router.id;
        }

        const pkg = await prisma.package.create({
            data: {
                ...validatedData,
                routerId: routerId || null,
                status: "ACTIVE",
                tenantId: userPayload.tenantId
            },
        });

        return jsonResponse(pkg, 201);
    } catch (e: any) {
        console.error("[PACKAGE CREATE ERROR]:", e?.message || e);
        // Expose meaningful error to client (never expose raw stack in prod but give useful message)
        const msg = e?.message?.includes('Unique constraint') ? 'A package with that name already exists.'
            : e?.message?.includes('Foreign key') ? 'Invalid router reference.'
            : e?.message || 'Internal server error';
        return errorResponse(msg, 500);
    }
}
