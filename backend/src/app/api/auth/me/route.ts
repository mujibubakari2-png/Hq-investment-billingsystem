import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { getUserFromRequest, jsonResponse, errorResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const payload = getUserFromRequest(req);
        if (!payload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(payload);

        const user = await db.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                fullName: true,
                status: true,
                lastLogin: true,
                tenantId: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true,
                        email: true,
                        branding: {
                            select: {
                                companyName: true,
                                companyLogo: true,
                                companyEmail: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return errorResponse("User not found", 404);
        }

        return jsonResponse({
            ...user,
            tenant_id: user.tenantId, // Alias for tests
            isPlatformAdmin: user.role === "SUPER_ADMIN" && !user.tenantId,
            companyName: user.tenant?.branding?.companyName || user.tenant?.name,
            companyLogo: user.tenant?.branding?.companyLogo || user.tenant?.logoUrl,
            companyEmail: user.tenant?.branding?.companyEmail || user.tenant?.email,
            tenantSlug: user.tenant?.slug,
        });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
