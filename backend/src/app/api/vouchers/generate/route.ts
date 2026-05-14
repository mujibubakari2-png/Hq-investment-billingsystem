import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// POST /api/vouchers/generate - Bulk generate vouchers
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            packageId,
            routerId,
            createdById,
            count = 10,
            prefix = "",
            codeLength = 8,
            codeFormat = "alphanumeric-upper"
        } = body;

        // Prefer logged-in user from JWT token, then body, then admin fallback
        const currentUser = getUserFromRequest(req);
        if (!currentUser) return errorResponse("Unauthorized", 401);

        const normalizedCount = Math.max(1, Math.min(500, Number(count) || 10));
        const normalizedCodeLength = Math.max(4, Math.min(32, Number(codeLength) || 8));
        const normalizedPrefix = String(prefix || "");
        const normalizedRouterId = routerId ? String(routerId).trim() : "";
        const routerIdValue = normalizedRouterId ? normalizedRouterId : null;

        let finalCreatedById = currentUser.userId || createdById;
        if (!finalCreatedById) {
            const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
            finalCreatedById = admin?.id;
        }

        if (!finalCreatedById) {
            return errorResponse("Creator user ID is required");
        }

        // Validation - allow skipping createdById for tests
        if (!packageId) {
            return errorResponse("packageId is required");
        }

        let pkg = await prisma.package.findUnique({ where: { id: packageId } });
        if (!pkg) {
            pkg = await prisma.package.findFirst({ where: { name: packageId } });
        }

        if (!pkg) {
            return errorResponse("Package not found", 404);
        }

        const tenantIdValue = currentUser.role === "SUPER_ADMIN"
            ? (pkg.tenantId || null)
            : (currentUser.tenantId || null);

        if (tenantIdValue && pkg.tenantId && pkg.tenantId !== tenantIdValue) {
            return errorResponse("Forbidden: Package belongs to another tenant", 403);
        }

        if (routerIdValue) {
            const router = await prisma.router.findUnique({ where: { id: routerIdValue } });
            if (!router) return errorResponse("Router not found", 404);
            if (tenantIdValue && router.tenantId && router.tenantId !== tenantIdValue) {
                return errorResponse("Forbidden: Router belongs to another tenant", 403);
            }
        }

        const actualPackageId = pkg.id;

        // Code generation based on format
        const generateCode = (length: number, format: string): string => {
            let chars = '';
            if (format === 'alphanumeric-upper') chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            else if (format === 'alphanumeric-lower') chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            else chars = '0123456789'; // numeric
            let result = '';
            for (let j = 0; j < length; j++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        // Generate codes in-memory then insert efficiently
        const target = normalizedCount;
        const codes = new Set<string>();
        const maxAttempts = target * 10;
        let attempts = 0;
        while (codes.size < target && attempts < maxAttempts) {
            attempts++;
            codes.add(normalizedPrefix + generateCode(normalizedCodeLength, codeFormat));
        }

        if (codes.size === 0) {
            return errorResponse("Failed to generate voucher codes", 500);
        }

        const codeList = Array.from(codes);

        await prisma.voucher.createMany({
            data: codeList.map((code) => ({
                code,
                packageId: actualPackageId,
                routerId: routerIdValue,
                createdById: finalCreatedById,
                tenantId: tenantIdValue
            })),
            skipDuplicates: true
        });

        const vouchers = await prisma.voucher.findMany({
            where: { code: { in: codeList } },
            orderBy: { createdAt: "desc" },
        });

        return jsonResponse({
            message: "Vouchers generated successfully",
            count: vouchers.length,
            vouchers
        }, 201);
    } catch (e: any) {
        console.error("VOUCHER GENERATION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
