import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { parseOptionalDate } from "@/lib/dateUtils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        const body = await req.json();

        // INV-002 FIX: Prevent invalid status transitions.
        // A PAID invoice must not be reverted to DRAFT/SENT — this would corrupt billing records.
        if (body.status) {
            const current = await db.invoice.findUnique({ where: { id }, select: { status: true } });
            if (!current) return errorResponse("Invoice not found", 404);

            const FORBIDDEN_REGRESSIONS: Record<string, string[]> = {
                PAID: ["DRAFT", "SENT", "OVERDUE"],
                CANCELLED: ["PAID", "DRAFT", "SENT", "OVERDUE"],
            };
            const forbidden = FORBIDDEN_REGRESSIONS[current.status];
            const newStatus = body.status.toUpperCase();
            if (forbidden?.includes(newStatus)) {
                return errorResponse(
                    `Cannot change status from ${current.status} to ${newStatus}`,
                    409
                );
            }
        }

        const invoice = await db.invoice.update({
            where: { id },
            data: {
                amount: body.amount ? parseFloat(body.amount) : undefined,
                status: body.status?.toUpperCase(),
                dueDate: parseOptionalDate(body.dueDate),
            },
        });

        return jsonResponse(invoice);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        await db.invoice.delete({ where: { id } });
        return jsonResponse({ message: "Invoice deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
