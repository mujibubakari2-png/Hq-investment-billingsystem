import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/invoices
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";

        // Build where filter dynamically
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { client: { username: { contains: search, mode: "insensitive" } } },
            ];
        }

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                client: { select: { username: true, fullName: true } },
                items: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const mapped = invoices.map((inv: {
            id: string;
            invoiceNumber: string;
            client: { username: string; fullName: string };
            amount: number;
            status: string;
            dueDate: Date;
            issuedDate: Date;
            items: { description: string; quantity: number; unitPrice: number; total: number }[];
        }) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            client: inv.client.username,
            clientName: inv.client.fullName,
            amount: inv.amount,
            status: inv.status.charAt(0) + inv.status.slice(1).toLowerCase(),
            dueDate: inv.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            issuedDate: inv.issuedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            items: inv.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
            })),
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/invoices
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: body.invoiceNumber || `INV-${Date.now()}`,
                clientId: body.clientId,
                amount: parseFloat(body.amount),
                status: (body.status || "DRAFT").toUpperCase(),
                dueDate: new Date(body.dueDate),
                issuedDate: new Date(body.issuedDate || new Date()),
                items: {
                    create: (body.items || []).map((item: { description: string; quantity: number; unitPrice: number; total: number }) => ({
                        description: item.description,
                        quantity: parseInt(String(item.quantity)),
                        unitPrice: parseFloat(String(item.unitPrice)),
                        total: parseFloat(String(item.total)),
                    })),
                },
            },
            include: { items: true },
        });

        return jsonResponse(invoice, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
