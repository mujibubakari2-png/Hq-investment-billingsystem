import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { toISOSafe, parseSafeDate } from "@/lib/dateUtils";
import { InvoiceCreateSchema } from "@/lib/validators";

// GET /api/invoices
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        // API-003 FIX: Use empty filter for SUPER_ADMIN so they see all invoices.
        // Previously tenantFilter was unconditionally set to { tenantId: userPayload.tenantId }
        // which caused SUPER_ADMIN to only see their own tenant's invoices.
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";

        // Build where filter dynamically
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { client: { username: { contains: search, mode: "insensitive" } } },
            ];
        }

        const invoices = await db.invoice.findMany({
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
            dueDate: toISOSafe(inv.dueDate),
            issuedDate: toISOSafe(inv.issuedDate),
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const body = await req.json();
        const parsed = InvoiceCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const data = parsed.data;
        const tenantIdValue = userPayload.tenantId;

        // API-002 FIX: Validate that clientId belongs to the requesting tenant.
        if (data.clientId) {
            const client = await db.client.findUnique({ where: { id: data.clientId } });
            if (!client) return errorResponse("Client not found", 404);
            if (!isSuperAdmin && client.tenantId !== userPayload.tenantId) {
                return errorResponse("Forbidden: client does not belong to your tenant", 403);
            }
        }

        const invoice = await db.invoice.create({
            data: {
                invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
                clientId: data.clientId,
                amount: data.amount,
                status: data.status || "DRAFT",
                dueDate: parseSafeDate(data.dueDate) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                issuedDate: parseSafeDate(data.issuedDate) || new Date(),
                tenantId: tenantIdValue,
                items: {
                    create: (data.items || []).map((item: { description: string; quantity: number; unitPrice: number; total: number }) => ({
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
