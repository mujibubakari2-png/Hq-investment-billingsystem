import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { parseOptionalDate } from "@/lib/dateUtils";
import { InvoiceUpdateSchema } from "@/lib/validators";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "invoices:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const invoice = await db.invoice.findUnique({
            where: { id },
            include: { client: true, items: true },
        });
        if (!invoice) return errorResponse("Invoice not found", 404);
        return jsonResponse(invoice);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "invoices:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const parsed = InvoiceUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data;

        // INV-002 FIX: Prevent invalid status transitions.
        if (update.status) {
            const current = await db.invoice.findUnique({ where: { id }, select: { status: true } });
            if (!current) return errorResponse("Invoice not found", 404);

            const FORBIDDEN_REGRESSIONS: Record<string, string[]> = {
                PAID: ["DRAFT", "SENT", "OVERDUE"],
                CANCELLED: ["PAID", "DRAFT", "SENT", "OVERDUE"],
            };
            const forbidden = FORBIDDEN_REGRESSIONS[current.status];
            const newStatus = update.status.toUpperCase();
            if (forbidden?.includes(newStatus)) {
                return errorResponse(`Cannot change status from ${current.status} to ${newStatus}`, 409);
            }
        }

        const existing = await db.invoice.findUnique({ where: { id } });
        if (!existing) return errorResponse("Invoice not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);

        const invoice = await db.invoice.update({
            where: { id },
            data: {
                amount: typeof update.amount !== 'undefined' ? update.amount : undefined,
                status: update.status,
                dueDate: update.dueDate ? parseOptionalDate(update.dueDate as any) : undefined,
            },
        });

        return jsonResponse(invoice);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "invoices:delete");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const existing = await db.invoice.findUnique({ where: { id } });
        if (!existing) return errorResponse("Invoice not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);

        await db.invoice.delete({ where: { id } });
        return jsonResponse({ message: "Invoice deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
