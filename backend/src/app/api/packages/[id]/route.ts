import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { getTenantClient } from "@/lib/tenantPrisma";
import { PackageUpdateSchema } from "@/lib/validators";

// GET /api/packages/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const pkg = await db.package.findUnique({
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const parsed = PackageUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data;

        const routerId = update.routerId || update.router || body.routerId || body.router;
        const router = routerId
            ? await db.router.findFirst({ where: { OR: [{ id: routerId }, { name: routerId }], tenantId: userPayload.tenantId } })
            : null;

        const dataToUpdate: any = {};
        if (update.name) dataToUpdate.name = update.name;
        if (update.type) dataToUpdate.type = update.type;
        if (update.category) dataToUpdate.category = update.category;
        if (update.uploadSpeed) dataToUpdate.uploadSpeed = update.uploadSpeed;
        if (update.uploadUnit) dataToUpdate.uploadUnit = update.uploadUnit;
        if (update.downloadSpeed) dataToUpdate.downloadSpeed = update.downloadSpeed;
        if (update.downloadUnit) dataToUpdate.downloadUnit = update.downloadUnit;
        if (update.price) dataToUpdate.price = update.price;
        if (update.duration) dataToUpdate.duration = update.duration;
        if (update.durationUnit) dataToUpdate.durationUnit = update.durationUnit?.toUpperCase();
        if (typeof update.burstEnabled !== 'undefined') dataToUpdate.burstEnabled = update.burstEnabled;
        if (update.hotspotType) dataToUpdate.hotspotType = update.hotspotType === "Data-capped" ? "DATA_CAPPED" : update.hotspotType === "Unlimited" ? "UNLIMITED" : update.hotspotType;
        if (typeof update.devices !== 'undefined') dataToUpdate.devices = update.devices;
        if (update.paymentType) dataToUpdate.paymentType = update.paymentType;
        if (update.status) dataToUpdate.status = update.status;
        if (router) dataToUpdate.routerId = router.id;

        const pkg = await db.package.update({ where: { id }, data: dataToUpdate });

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
                await db.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        tenantId: pkg.tenantId,
                        action: "package_profile_synced",
                        details: `Synced profile after updating package "${pkg.name}" (${pkg.type})`,
                        status: "success",
                    }
                });
            } catch (err: any) {
                await db.routerLog.create({
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;

        // Manual cascade delete to handle foreign key constraints
        await db.$transaction([
            db.subscription.deleteMany({ where: { packageId: id } }),
            db.voucher.deleteMany({ where: { packageId: id } }),
            db.package.delete({ where: { id } })
        ]);

        return jsonResponse({ message: "Package deleted successfully" });
    } catch (err: any) {
        return errorResponse(`Failed to delete package: ${err.message}`, 500);
    }
}
