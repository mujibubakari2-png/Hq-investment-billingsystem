import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { parseOptionalDate } from "@/lib/dateUtils";
import { ExpenseUpdateSchema } from "@/lib/validators";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(_req, "expenses:read");
        if (guard.error) return guard.error;
        const db = getTenantClient(guard.user);

        const { id } = await params;
        const expense = await db.expense.findUnique({
            where: { id },
            include: { createdBy: { select: { username: true } } },
        });
        if (!expense) return errorResponse("Expense not found", 404);
        return jsonResponse(expense);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "expenses:write");
        if (guard.error) return guard.error;
        const db = getTenantClient(guard.user);

        const { id } = await params;
        const body = await req.json();

        const parsed = ExpenseUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }

        const existing = await db.expense.findFirst({ where: { id } });
        if (!existing) return errorResponse("Expense not found", 404);

        const update = parsed.data;
        const dataToUpdate: any = {};
        if (update.category) dataToUpdate.category = update.category;
        if (update.description) dataToUpdate.description = update.description;
        if (update.amount) dataToUpdate.amount = update.amount;
        if (update.date) dataToUpdate.date = parseOptionalDate(update.date as any);
        if (update.reference) dataToUpdate.reference = update.reference;
        if (update.receipt) dataToUpdate.receipt = update.receipt;

        const expense = await db.expense.update({ where: { id }, data: dataToUpdate });
        return jsonResponse(expense);
    } catch (err) {
        console.error(err);
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "expenses:delete");
        if (guard.error) return guard.error;
        const db = getTenantClient(guard.user);

        const { id } = await params;
        const existing = await db.expense.findFirst({ where: { id } });
        if (!existing) return errorResponse("Expense not found", 404);

        await db.expense.delete({ where: { id } });
        return jsonResponse({ message: "Expense deleted" });
    } catch (err) {
        console.error(err);
        return errorResponse("Internal server error", 500);
    }
}
