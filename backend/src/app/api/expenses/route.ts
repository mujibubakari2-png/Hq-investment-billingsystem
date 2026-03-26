import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/expenses
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category") || "";
        const search = searchParams.get("search") || "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (category) where.category = category;
        if (search) {
            where.OR = [
                { description: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
            ];
        }

        const expenses = await prisma.expense.findMany({
            where,
            include: { createdBy: { select: { username: true } } },
            orderBy: { date: "desc" },
        });

        const mapped = expenses.map((e: {
            id: string;
            category: string;
            description: string;
            amount: number;
            date: Date;
            reference: string | null;
            createdBy: { username: string };
        }) => ({
            id: e.id,
            category: e.category,
            description: e.description,
            amount: e.amount,
            date: e.date.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }),
            reference: e.reference,
            createdBy: e.createdBy.username,
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/expenses
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        let createdById = body.createdById || body.created_by;
        if (!createdById) {
            const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
            createdById = admin?.id;
        }

        if (!createdById) {
            return errorResponse("Creator user ID is required");
        }

        const amount = parseFloat(body.amount) || parseFloat(body.amount_value) || 0;

        const expense = await prisma.expense.create({
            data: {
                category: body.category || "OTHER",
                description: body.description || "N/A",
                amount,
                date: body.date ? new Date(body.date) : new Date(),
                reference: body.reference || `EXP-${Date.now()}`,
                receipt: body.receipt,
                createdById,
            },
        });

        return jsonResponse({
            ...expense,
            amount_value: expense.amount, // Alias
            created_by: expense.createdById, // Alias
        }, 201);
    } catch (e) {
        console.error("EXPENSE POST ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
