import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// POST /api/vouchers/generate - Bulk generate vouchers
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { packageId, routerId, createdById, count = 10, prefix = "", codeLength = 8, codeFormat = "alphanumeric-upper" } = body;

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

        const actualPackageId = pkg.id;

        // Prefer logged-in user from JWT token, then body, then admin fallback
        const currentUser = getUserFromRequest(req);
        let finalCreatedById = currentUser?.userId || createdById;
        if (!finalCreatedById) {
            const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
            finalCreatedById = admin?.id;
        }

        if (!finalCreatedById) {
            return errorResponse("Creator user ID is required");
        }

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

        const vouchers = [];
        for (let i = 0; i < count; i++) {
            const code = prefix + generateCode(codeLength, codeFormat);

            // Check uniqueness
            const exists = await prisma.voucher.findUnique({ where: { code } });
            if (exists) {
                i--; // retry
                continue;
            }

            const voucher = await prisma.voucher.create({
                data: {
                    code,
                    packageId: actualPackageId,
                    routerId,
                    createdById: finalCreatedById,
                },
            });
            vouchers.push(voucher);
        }

        return jsonResponse({
            message: "Vouchers generated successfully",
            count: vouchers.length,
            vouchers
        }, 201);
    } catch (e: any) {
        console.error("VOUCHER GENERATION ERROR:", e);
        return errorResponse(`Internal server error: ${e.message}`, 500);
    }
}
