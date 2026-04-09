import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { parseOptionalDate } from "@/lib/dateUtils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const expense = await prisma.expense.findUnique({
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
        const { id } = await params;
        const body = await req.json();

        const expense = await prisma.expense.update({
            where: { id },
            data: {
                category: body.category,
                description: body.description,
                amount: body.amount ? parseFloat(body.amount) : undefined,
                date: parseOptionalDate(body.date),
                reference: body.reference,
                receipt: body.receipt,
            },
        });

        return jsonResponse(expense);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.expense.delete({ where: { id } });
        return jsonResponse({ message: "Expense deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
