import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/packages/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const pkg = await prisma.package.findUnique({
            where: { id },
            include: { router: true },
        });
        if (!pkg) return errorResponse("Package not found", 404);
        return jsonResponse(pkg);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/packages/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const router = body.router
            ? await prisma.router.findFirst({ where: { name: body.router } })
            : null;

        const pkg = await prisma.package.update({
            where: { id },
            data: {
                name: body.name,
                type: body.type === "PPPoE" ? "PPPOE" : "HOTSPOT",
                category: body.category === "Business" ? "BUSINESS" : "PERSONAL",
                uploadSpeed: body.uploadSpeed ? parseFloat(body.uploadSpeed) : undefined,
                uploadUnit: body.uploadUnit,
                downloadSpeed: body.downloadSpeed ? parseFloat(body.downloadSpeed) : undefined,
                downloadUnit: body.downloadUnit,
                price: body.price ? parseFloat(body.price) : undefined,
                duration: body.duration ? parseInt(body.duration) : undefined,
                durationUnit: body.durationUnit?.toUpperCase(),
                burstEnabled: body.burstEnabled,
                hotspotType: body.hotspotType === "Data-capped" ? "DATA_CAPPED" : body.hotspotType === "Unlimited" ? "UNLIMITED" : undefined,
                devices: body.devices ? parseInt(body.devices) : undefined,
                paymentType: body.paymentType === "Postpaid" ? "POSTPAID" : body.paymentType === "Prepaid" ? "PREPAID" : undefined,
                status: body.status === "Inactive" ? "INACTIVE" : body.status === "Active" ? "ACTIVE" : undefined,
                routerId: router?.id,
            },
        });

        // Best-effort: sync MikroTik bandwidth profile when package changes
        if (pkg.routerId) {
            try {
                const mikrotik = await getMikroTikService(pkg.routerId);
                await mikrotik.createProfileFromPackage(
                    pkg.name,
                    pkg.uploadSpeed,
                    pkg.uploadUnit,
                    pkg.downloadSpeed,
                    pkg.downloadUnit,
                    pkg.type === "PPPOE" ? "pppoe" : "hotspot",
                    pkg.devices || 1,
                );
                await prisma.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        tenantId: pkg.tenantId,
                        action: "package_profile_synced",
                        details: `Synced profile after updating package "${pkg.name}" (${pkg.type})`,
                        status: "success",
                    }
                });
            } catch (err: any) {
                await prisma.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        tenantId: pkg.tenantId,
                        action: "package_profile_sync_failed",
                        details: `Failed to sync profile after updating "${pkg.name}": ${err?.message || "Unknown error"}`,
                        status: "error",
                    }
                });
            }
        }

        return jsonResponse(pkg);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/packages/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.package.delete({ where: { id } });
        return jsonResponse({ message: "Package deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
