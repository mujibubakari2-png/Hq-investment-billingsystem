import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { VoucherCreateSchema } from "@/lib/validators";
import logger from "@/lib/logger";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "vouchers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const resolvedParams = await params;
        const body = await req.json() as any;

        const parsed = VoucherCreateSchema.partial().safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { status, usedBy, customer, code } = parsed.data as any;

        const existingVoucher = await db.voucher.findUnique({ where: { id: resolvedParams.id } });
        if (!existingVoucher) return errorResponse("Voucher not found", 404);
        if (!canAccessTenant(userPayload, existingVoucher.tenantId)) {
            return errorResponse("Voucher not found", 404);
        }

        const updated = await db.voucher.update({
            where: { id: resolvedParams.id },
            data: {
                code,
                status: status as any,
                usedBy,
                customer: typeof customer === 'number' ? customer : customer ? parseInt(String(customer), 10) : null,
            }
        });

        return jsonResponse(updated);
    } catch (e: any) {
        logger.error("VOUCHER UPDATE ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Failed to update voucher", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "vouchers:delete");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const resolvedParams = await params;

        const existingVoucher = await db.voucher.findUnique({ where: { id: resolvedParams.id } });
        if (!existingVoucher) return errorResponse("Voucher not found", 404);
        if (!canAccessTenant(userPayload, existingVoucher.tenantId)) {
            return errorResponse("Voucher not found", 404);
        }

        await db.voucher.delete({
            where: { id: resolvedParams.id }
        });
        return jsonResponse({ message: "Voucher deleted successfully" });
    } catch (e: any) {
        logger.error("VOUCHER DELETE ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Failed to delete voucher", 500);
    }
}
