import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/packages
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "";
        const status = searchParams.get("status") || "";
        const routerId = searchParams.get("routerId") || "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
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
        const body = await req.json();

        // Validation
        if (!body.name) return errorResponse("Package name is required");
        if (!body.price) return errorResponse("Price is required");
        if (!body.duration) return errorResponse("Duration is required");

        let routerId = body.routerId || body.router;
        if (routerId) {
            const router = await prisma.router.findFirst({
                where: {
                    OR: [
                        { id: routerId },
                        { name: routerId }
                    ]
                }
            });
            routerId = router?.id;
        }

        const pkg = await prisma.package.create({
            data: {
                name: body.name,
                type: body.type === "PPPoE" || body.type === "PPPOE" ? "PPPOE" : "HOTSPOT",
                category: body.category === "Business" || body.category === "BUSINESS" ? "BUSINESS" : "PERSONAL",
                uploadSpeed: parseFloat(body.uploadSpeed) || 0,
                uploadUnit: body.uploadUnit || "M",
                downloadSpeed: parseFloat(body.downloadSpeed) || 0,
                downloadUnit: body.downloadUnit || "M",
                price: parseFloat(body.price),
                duration: parseInt(body.duration),
                durationUnit: (body.durationUnit || "DAYS").toUpperCase() as any,
                routerId: routerId || null,
                status: "ACTIVE",
            },
        });

        return jsonResponse(pkg, 201);
    } catch (e) {
        console.error("PACKAGE POST ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
